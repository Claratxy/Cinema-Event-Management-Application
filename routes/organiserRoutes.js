const express = require('express');
// For securely hashing passwords
const bcrypt = require('bcrypt');
// Create router object to define organiser-related endpoints
const router = express.Router();

/**
 * Middleware: checkAuth
 * Purpose: Restricts access to routes that require the organiser to be logged in
 * Inputs: Express req, res, next
 * Outputs: Redirects to login if not authenticated, otherwise proceeds
*/
function checkAuth(req, res, next) {
    if (!req.session.organiserId) return res.redirect('/organiser/login');
    next();
}

/**
 * GET /organiser/register
 * Purpose: Render the organiser registration form
 * Inputs: None
 * Outputs: Renders organiserRegister.ejs
*/
router.get('/register', (req, res) => res.render('organiserRegister'));

/**
 * POST /organiser/register
 * Purpose: Register a new organiser and create their default cinema settings
 * Inputs: username, password from form body
 * Outputs: On success, redirect to login; on failure, render error page
 * DB:
 *  - INSERT into organisers table
 *  - INSERT into settings table with default values
*/
router.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Basic input validation
    if (!username || !password || username.trim().length < 3 || password.length < 5) {
        return res.render('errorPage', { message: "Username must be at least 3 characters and password at least 5 characters." });
    }

    // Encrypt password and insert organiser
    bcrypt.hash(password, 10, (err, hashed) => {
        if (err) return res.render('errorPage', { message: "Password encryption failed." });

        db.run("INSERT INTO organisers (username, password) VALUES (?, ?)", [username.trim(), hashed], function(err) {
            if (err) return res.render('errorPage', { message: "Username already exists or registration failed." });

            // Create default cinema settings after successful organiser creation
            db.run("INSERT INTO settings (organiser_id, cinema_name, cinema_description, cinema_location) VALUES (?, ?, ?, ?)",
                [this.lastID, 'My Cinema', 'Your awesome cinema description here', 'Cinema address'],
                (err) => {
                    if (err) return res.render('errorPage', { message: "Settings creation failed." });
                    res.redirect('/organiser/login');
                });
        });
    });
});

/**
 * GET /organiser/login
 * Purpose: Render the organiser login form
 * Inputs: None
 * Outputs: Renders organiserLogin.ejs
 */
router.get('/login', (req, res) => res.render('organiserLogin'));

/**
 * POST /organiser/login
 * Purpose: Authenticate organiser and start session
 * Inputs: username, password from form body
 * Outputs: On success, redirect to /organiser/home; else render error
 * DB:
 *  - SELECT organiser by username
 *  - bcrypt.compare to validate password
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Look up the organiser by username
    db.get("SELECT * FROM organisers WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.render('errorPage', { message: "Invalid credentials." });

        // Compare submitted password with hashed password in database
        bcrypt.compare(password, user.password, (err, result) => {
            if (!result) return res.render('errorPage', { message: "Invalid credentials." });

            // Save organiser ID in session to maintain login
            req.session.organiserId = user.id;
            res.redirect('/organiser/home');
        });
    });
});

/**
 * GET /organiser/home
 * Purpose: Show organiser dashboard with cinema info and screenings
 * Inputs: organiserId from session
 * Outputs: Renders organiserHome.ejs with settings, drafts, and published screenings
 * DB:
 *  - SELECT settings for organiser
 *  - SELECT all screenings for organiser
*/
router.get('/home', checkAuth, (req, res) => {
    const organiserId = req.session.organiserId;

    // Get organiser settings (cinema name, etc.)
    db.get("SELECT * FROM settings WHERE organiser_id = ?", [organiserId], (err, settings) => {
        if (err) return res.render('errorPage', { message: "Settings load failed." });

        // Get published screenings
        db.all("SELECT * FROM screenings WHERE organiser_id = ?", [organiserId], (err, screenings) => {
            if (err) return res.render('errorPage', { message: "Screenings load failed." });

            const published = screenings.filter(s => s.status === 'published');
            const drafts = screenings.filter(s => s.status === 'draft');
            res.render('organiserHome', { settings, published, drafts });
        });
    });
});

/**
 * GET /organiser/settings
 * Purpose: Display organiser's cinema settings form
 * Inputs: organiserId from session
 * Outputs: Renders organiserSettings.ejs
 * DB: SELECT settings for organiser
*/
router.get('/settings', checkAuth, (req, res) => {
    db.get("SELECT * FROM settings WHERE organiser_id = ?", [req.session.organiserId], (err, row) => {
        if (err) return res.render('errorPage', { message: "Error loading settings." });
        res.render('organiserSettings', { settings: row });
    });
});

/**
 * POST /organiser/settings
 * Purpose: Update organiser's cinema settings
 * Inputs: cinema_name, cinema_description, cinema_location from form
 * Outputs: Redirects to /organiser/home on success
 * DB: UPDATE settings table
 */
router.post('/settings', checkAuth, (req, res) => {
    const { cinema_name, cinema_description, cinema_location } = req.body;
    db.run("UPDATE settings SET cinema_name = ?, cinema_description = ?, cinema_location = ? WHERE organiser_id = ?",
        [cinema_name, cinema_description, cinema_location, req.session.organiserId],
        (err) => {
            if (err) return res.render('errorPage', { message: "Update failed." });
            res.redirect('/organiser/home');
        });
});

/**
 * GET /organiser/create
 * Purpose: Render empty form to create a new screening
 * Inputs: None
 * Outputs: Renders editScreening.ejs with null screening
*/
router.get('/create', checkAuth, (req, res) => res.render('editScreening', { screening: null }));

/**
 * POST /organiser/create
 * Purpose: Add a new screening to the database
 * Inputs: screening fields from form
 * Outputs: Redirect to edit page of newly created screening
 * DB: INSERT INTO screenings
*/
router.post('/create', checkAuth, function(req, res) {
    const {
        movie_title, genre, description, 
        full_price_count, full_price_amount,
        concession_count, concession_amount
    } = req.body;

    // Validate essential fields
    if (!movie_title || isNaN(parseFloat(full_price_amount))) {
        return res.render('errorPage', { message: "Please fill in all required fields correctly." });
    }

    const concession = concession_amount && concession_amount.trim() !== '' ? parseFloat(concession_amount) : null;
    const now = new Date().toISOString();

    // Insert new screening as draft
    db.run(`INSERT INTO screenings 
        (organiser_id, movie_title, genre, description, 
        full_price_count, full_price_amount, concession_count, concession_amount, 
        created_at, last_modified, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [
            req.session.organiserId,
            movie_title.trim(),
            genre || null,
            description.trim(),
            parseInt(full_price_count),
            parseFloat(full_price_amount),
            parseInt(concession_count),
            concession,
            now,
            now
        ],
        function(err) {
            if (err) return res.render('errorPage', { message: "Failed to create screening." });
            // Redirect to edit screen for this new screening
            res.redirect('/organiser/edit/' + this.lastID);
        });
});

/**
 * GET /organiser/edit/:id
 * Purpose: Render edit form for a specific screening
 * Inputs: screening ID from route, organiserId from session
 * Outputs: Renders editScreening.ejs with screening and its times
 * DB:
 *  - SELECT screening by ID and organiser
 *  - SELECT screening_times for that screening
*/
router.get('/edit/:id', checkAuth, (req, res) => {
    db.get("SELECT * FROM screenings WHERE id = ? AND organiser_id = ?", [req.params.id, req.session.organiserId], (err, screening) => {
        if (err || !screening) return res.render('errorPage', { message: "Screening not found." });

        // Get all times linked to this screening
        db.all("SELECT * FROM screening_times WHERE screening_id = ?", [req.params.id], (err2, screeningTimes) => {
            if (err2) screeningTimes = [];
            // Render edit form populated with current data
            res.render('editScreening', { screening, screeningTimes });
        });
    });
});

/**
 * POST /organiser/edit/:id
 * Purpose: Save updates to a screening
 * Inputs: screening form fields, screening ID from route
 * Outputs: Redirect to /organiser/home on success
 * DB: UPDATE screenings table
*/
router.post('/edit/:id', checkAuth, (req, res) => {
    const {
        movie_title, genre, description, 
        full_price_count, full_price_amount,
        concession_count, concession_amount
    } = req.body;

    const concession = concession_amount && concession_amount.trim() !== '' ? parseFloat(concession_amount) : null;
    const now = new Date().toISOString();

    db.run(`UPDATE screenings SET 
        movie_title = ?, genre = ?, description = ?, 
        full_price_count = ?, full_price_amount = ?, 
        concession_count = ?, concession_amount = ?, 
        last_modified = ? 
        WHERE id = ? AND organiser_id = ?`,
        [
            movie_title,
            genre || null,
            description,
            parseInt(full_price_count),
            parseFloat(full_price_amount),
            parseInt(concession_count),
            concession,
            now,
            req.params.id,
            req.session.organiserId
        ],
        (err) => {
            if (err) return res.render('errorPage', { message: "Update failed." });
            res.redirect('/organiser/home');
        });
});

/**
 * POST /organiser/publish/:id
 * Purpose: Set the status of a screening to 'published'
 * Inputs: screening ID from route
 * Outputs: Redirect to /organiser/home
 * DB: UPDATE screenings table
 */
router.post('/publish/:id', checkAuth, (req, res) => {
    db.run("UPDATE screenings SET status = 'published', published_at = ? WHERE id = ? AND organiser_id = ?",
        [new Date().toISOString(), req.params.id, req.session.organiserId],
        (err) => {
            if (err) return res.render('errorPage', { message: "Publish failed." });
            res.redirect('/organiser/home');
        });
});

/**
 * POST /organiser/delete/:id
 * Purpose: Delete a screening created by the organiser
 * Inputs: screening ID from route
 * Outputs: Redirect to /organiser/home
 * DB: DELETE FROM screenings
*/
router.post('/delete/:id', checkAuth, (req, res) => {
    db.run("DELETE FROM screenings WHERE id = ? AND organiser_id = ?", [req.params.id, req.session.organiserId], (err) => {
        if (err) return res.render('errorPage', { message: "Delete failed." });
        res.redirect('/organiser/home');
    });
});

/**
 * POST /organiser/edit/:id/add-time
 * Purpose: Add a new time slot to a screening
 * Inputs: screening ID from route, datetime from form
 * Outputs: Redirect back to the edit page
 * DB: INSERT INTO screening_times
*/
router.post('/edit/:id/add-time', checkAuth, (req, res) => {
    const screeningId = req.params.id;
    const datetime = req.body.screening_datetime;

    db.run("INSERT INTO screening_times (screening_id, screening_datetime) VALUES (?, ?)",
        [screeningId, datetime],
        (err) => {
            if (err) return res.render('errorPage', { message: "Failed to add screening time." });
            res.redirect('/organiser/edit/' + screeningId);
        });
});

/**
 * POST /organiser/edit/:id/delete-time/:timeId
 * Purpose: Remove a time slot from a screening
 * Inputs: screening ID and time ID from route
 * Outputs: Redirect back to the edit page
 * DB: DELETE FROM screening_times
*/
router.post('/edit/:id/delete-time/:timeId', checkAuth, (req, res) => {
    const { id, timeId } = req.params;

    db.run("DELETE FROM screening_times WHERE id = ? AND screening_id = ?", [timeId, id], (err) => {
        if (err) return res.render('errorPage', { message: "Failed to delete screening time." });
        res.redirect('/organiser/edit/' + id);
    });
});

/**
 * POST /organiser/logout
 * Purpose: End the organiser's session and log them out
 * Inputs: None
 * Outputs: Redirect to homepage
*/
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
