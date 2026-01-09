PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Organisers table
-- Stores organiser (admin) login details
-- Inputs: username, password
-- Outputs: organiser ID (auto-incremented)
CREATE TABLE IF NOT EXISTS organisers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Settings table
-- Stores cinema profile info set by an organiser
-- One-to-one with organiser (organiser_id is also primary key here)
-- Inputs: organiser_id, cinema name, description, location
-- Outputs: saved cinema details
CREATE TABLE IF NOT EXISTS settings (
    organiser_id INTEGER PRIMARY KEY,
    cinema_name TEXT NOT NULL,
    cinema_description TEXT NOT NULL,
    cinema_location TEXT,
    FOREIGN KEY (organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);

-- Screenings table
-- Stores details of each movie screening created by organisers
-- Inputs: organiser_id, movie title, genre, description, date, ticket info
-- Outputs: screening ID, timestamps for creation, publishing, etc.
CREATE TABLE IF NOT EXISTS screenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organiser_id INTEGER NOT NULL,
    movie_title TEXT NOT NULL,
    genre TEXT,
    description TEXT,
    screening_date TEXT,
    full_price_count INTEGER DEFAULT 0,
    full_price_amount REAL DEFAULT 0.0,
    concession_count INTEGER DEFAULT 0,
    concession_amount REAL, -- can be NULL
    created_at TEXT,
    last_modified TEXT,
    published_at TEXT,
    status TEXT DEFAULT 'draft',
    FOREIGN KEY (organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);

-- Screening Times table
-- Stores specific date-times for each screening (used for multiple sessions)
-- Inputs: screening_id, screening_datetime
-- Outputs: time slot ID
CREATE TABLE IF NOT EXISTS screening_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screening_id INTEGER NOT NULL,
    screening_datetime TEXT NOT NULL,
    FOREIGN KEY (screening_id) REFERENCES screenings(id) ON DELETE CASCADE
);

-- Bookings table
-- Stores ticket bookings made by attendees for specific screening times
-- Inputs: screening_time_id, name, email, full/concession quantities
-- Outputs: booking ID, booking timestamp
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screening_time_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    email TEXT NOT NULL,
    full_price_qty INTEGER DEFAULT 0,
    concession_qty INTEGER DEFAULT 0,
    booked_at TEXT,
    FOREIGN KEY (screening_time_id) REFERENCES screening_times(id) ON DELETE CASCADE
);

-- Comments table
-- Stores feedback from attendees after viewing a screening
-- Inputs: screening_id, attendee name, comment text
-- Outputs: comment ID, timestamp
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    screening_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (screening_id) REFERENCES screenings(id) ON DELETE CASCADE
);

COMMIT;
