const express = require('express');
// Create a router for attendee-related endpoints
const router = express.Router();

/**
 * GET /attendee/home
 * Purpose: Display a list of all published screenings, optionally filtered by search query
 * Inputs: Optional query parameter ?search= (string)
 * Outputs: Renders attendeeHome.ejs with matched screenings and their times
 * DB:
 *   - SELECT all published screenings and their earliest screening time
 *   - SELECT all screening times for display
 */
router.get('/home', (req, res) => {
    // Get search query (or empty string if none)
    const search = req.query.search || '';
    // Wildcard pattern for SQL LIKE search
    const searchPattern = `%${search}%`;

    // SQL to get all published screenings matching the search
    const query = `
        SELECT 
            screenings.*, 
            settings.cinema_name, 
            settings.cinema_description,
            MIN(screening_times.screening_datetime) AS next_screening
        FROM screenings
        JOIN organisers ON screenings.organiser_id = organisers.id
        JOIN settings ON organisers.id = settings.organiser_id
        JOIN screening_times ON screening_times.screening_id = screenings.id
        WHERE screenings.status = 'published'
        AND (
            screenings.movie_title LIKE ? 
            OR screenings.genre LIKE ? 
            OR settings.cinema_name LIKE ? 
            OR settings.cinema_description LIKE ?
        )
        GROUP BY screenings.id
        ORDER BY next_screening ASC
    `;

    // Second query: get all screening times (not filtered) to show under each screening
    db.all(query, [searchPattern, searchPattern, searchPattern, searchPattern], (err, screenings) => {
        if (err) return res.render('errorPage', { message: "Failed to load screenings." });

        // Then fetch all screening times to group them under each screening
        db.all(`SELECT * FROM screening_times`, [], (err, screeningTimes) => {
            const groupedTimes = {};

            // Group times by screening ID for display on the attendee home page
            screeningTimes.forEach(time => {
                if (!groupedTimes[time.screening_id]) groupedTimes[time.screening_id] = [];
                groupedTimes[time.screening_id].push(time);
            });

            // Render the home page with filtered screenings and their time slots
            res.render('attendeeHome', { screenings, groupedTimes, search });
        });
    });
});

/**
 * GET /attendee/screening/:id
 * Purpose: Show details for a specific screening, including available times, ticket stats, and comments
 * Inputs: Screening ID from route
 * Outputs: Renders screeningPage.ejs with full info
 * DB:
 *   - SELECT screening details + cinema info
 *   - SELECT screening times
 *   - SELECT total booked tickets for full and concession
 *   - SELECT feedback comments for this screening
 */
router.get('/screening/:id', (req, res) => {
    const screeningId = req.params.id;

    // Get screening info + linked cinema data
    const query = `
        SELECT 
            screenings.*, 
            settings.cinema_name, 
            settings.cinema_location,
            settings.cinema_description
        FROM 
            screenings
        JOIN 
            organisers ON screenings.organiser_id = organisers.id
        JOIN 
            settings ON organisers.id = settings.organiser_id
        WHERE 
            screenings.id = ?
    `;

    db.get(query, [screeningId], (err, screening) => {
        if (err || !screening) return res.render('errorPage', { message: "Screening not found." });

        // Get all times for this screening
        db.all("SELECT * FROM screening_times WHERE screening_id = ?", [screeningId], (err, screeningTimes) => {
            if (err) screeningTimes = [];

            // Get number of full/concession tickets sold for this screening
            db.get(`
                SELECT SUM(full_price_qty) AS fullSold, SUM(concession_qty) AS concessionSold
                FROM bookings
                JOIN screening_times ON bookings.screening_time_id = screening_times.id
                WHERE screening_times.screening_id = ?
            `, [screeningId], (err, bookingTotals) => {
                if (err) bookingTotals = { fullSold: 0, concessionSold: 0 };

                // Get all comments posted about this screening
                db.all("SELECT * FROM comments WHERE screening_id = ?", [screeningId], (err, comments) => {
                    if (err) comments = [];

                    // Finally, render the screening detail page
                    res.render('screeningPage', {
                        screening, screeningTimes, bookingTotals, comments
                    });
                });
            });
        });
    });
});

/**
 * POST /attendee/screening/:id/book
 * Purpose: Allow attendee to book tickets for a specific screening time
 * Inputs:
 *   - screening_time_id, attendeeName, email
 *   - fullPriceQty, concessionQty from form body
 * Outputs:
 *   - On success: show successPage.ejs
 *   - On error: show errorPage.ejs with relevant message
 * DB:
 *   - Validate screening_time_id belongs to screening
 *   - Check if ticket quantities requested are available
 *   - Check for duplicate booking by email
 *   - INSERT into bookings table
 */
router.post('/screening/:id/book', (req, res) => {
    const screeningId = req.params.id;

    // Extract booking details from the form
    const { 
        screening_time_id, 
        attendeeName, email, 
        fullPriceQty, concessionQty 
    } = req.body;

    const fullQty = parseInt(fullPriceQty) || 0;
    const concessionQtyInt = parseInt(concessionQty) || 0;
    const bookedAt = new Date().toISOString();

    // Validation: must book at least 1 ticket, and non-negative quantities
    if (fullQty < 0 || concessionQtyInt < 0 || (fullQty === 0 && concessionQtyInt === 0)) {
        return res.render('errorPage', { message: "Invalid ticket quantity selected." });
    }

    // Step 0: Make sure the screening time belongs to the screening
    db.get(`
      SELECT st.id FROM screening_times st
      WHERE st.id = ? AND st.screening_id = ?
    `, [screening_time_id, screeningId], (err, stRow) => {
        if (err || !stRow) {
            return res.render('errorPage', { message: "Invalid screening time selected." });
        }

        // Step 1: Check remaining ticket availability
        const sqlCheck = `
            SELECT 
                s.full_price_count, 
                s.concession_count,
                IFNULL(SUM(b.full_price_qty), 0) AS totalFull, 
                IFNULL(SUM(b.concession_qty), 0) AS totalConcession
            FROM screening_times st
            JOIN screenings s ON st.screening_id = s.id
            LEFT JOIN bookings b ON b.screening_time_id = st.id
            WHERE st.id = ?
            GROUP BY s.full_price_count, s.concession_count
        `;

        db.get(sqlCheck, [screening_time_id], (err, row) => {
            if (err || !row) {
                return res.render('errorPage', { message: "Booking validation failed." });
            }

            const totalFull = row.totalFull;
            const totalConcession = row.totalConcession;
            const fullCount = row.full_price_count;
            const concessionCount = row.concession_count;

            // If ticket limits would be exceeded by this booking, reject
            if ((totalFull + fullQty > fullCount) || (totalConcession + concessionQtyInt > concessionCount)) {
                return res.render('errorPage', { message: "Not enough tickets available." });
            }

            // Step 2: Prevent duplicate booking (same email and time)
            db.get(`
                SELECT * FROM bookings 
                WHERE screening_time_id = ? AND email = ?
            `, [screening_time_id, email], (err, existingBooking) => {
                if (err) return res.render('errorPage', { message: "Duplicate check failed." });
                if (existingBooking) {
                    return res.render('errorPage', { message: "You have already booked tickets for this time." });
                }

                // Step 3: Insert the booking
                db.run(`
                    INSERT INTO bookings (screening_time_id, attendee_name, email, full_price_qty, concession_qty, booked_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [screening_time_id, attendeeName, email, fullQty, concessionQtyInt, bookedAt], (err) => {
                    if (err) return res.render('errorPage', { message: "Failed to book tickets." });

                    res.render('successPage', {
                        message: "Your booking was successful!",
                        returnLink: "/attendee/home"
                    });
                });
            });
        });
    });
});

/**
 * POST /attendee/comment/:id
 * Purpose: Submit a comment/feedback on a specific screening
 * Inputs:
 *   - screeningId from route
 *   - attendee_name, comment_text from form
 * Outputs:
 *   - On success: redirect back to screening page
 *   - On error: show errorPage.ejs
 * DB: INSERT INTO comments table
 */
router.post('/comment/:id', (req, res) => {
    const screeningId = req.params.id;
    const { attendee_name, comment_text } = req.body;
    const createdAt = new Date().toISOString();

    db.run("INSERT INTO comments (screening_id, attendee_name, comment_text, created_at) VALUES (?, ?, ?, ?)",
        [screeningId, attendee_name, comment_text, createdAt], (err) => {
            if (err) return res.render('errorPage', { message: "Failed to post comment." });

            // Redirect user back to the same screening page
            res.redirect('/attendee/screening/' + screeningId);
        });
});

// Export for use in index.js or main server
module.exports = router;
