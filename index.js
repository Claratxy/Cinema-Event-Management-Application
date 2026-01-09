/**
 * index.js
 * Main entry point for the Cinema web app
 * Purpose: Sets up express, database connection, session middleware, and mounts all routes
 * No direct input/output here — routes handle individual functionality
**/

const express = require('express');
const app = express();

const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const port = 3000;

// Middleware configuration
app.use(bodyParser.urlencoded({ extended: true })); // Parses form data from POST requests
app.set('view engine', 'ejs'); // Use EJS templating for rendering views
app.use(express.static(__dirname + '/public')); // Serve static assets (CSS, JS, images)
app.set('views', path.join(__dirname, 'views')); // Set the views folder

// Set up session handling
// Used to track organiser login sessions
app.use(session({
    secret: 'cinema-session-secret', // session encryption key
    resave: false,
    saveUninitialized: true
}));

// Set up SQLite database connection
// Makes a global connection accessible from any file
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function (err) {
    if (err) {
        console.error(err);
        process.exit(1); // Stop app if DB fails
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON"); // Enforce foreign key rules
    }
});

// Load organiser and attendee route files
const organiserRoutes = require('./routes/organiserRoutes'); // Handles organiser-side routes (login, manage screenings)
const attendeeRoutes = require('./routes/attendeeRoutes'); // Handles attendee-side routes (bookings, comments)

// Mount routes on appropriate paths
app.use('/organiser', organiserRoutes); // All organiser functions go here
app.use('/attendee', attendeeRoutes);   // All attendee functions go here

// Error handling middleware
// Catches any uncaught errors and displays a generic error page
app.use((err, req, res, next) => {
    console.error('Unexpected error:', err);
    res.status(500).render('errorPage', { message: 'Something went wrong. Please try again later.' });
});

// Homepage route
// Shows the main layout page with links to organiser/attendee portals
app.get('/', (req, res) => {
    res.render('layout');
});

// Start the server on localhost:3000
app.listen(port, () => {
    console.log(`🎥 Cinema app running at http://localhost:${port}`);
});
