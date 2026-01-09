### Cinema Event Management Application ###

This project is a web application for managing a cinema screening platform. It supports two
main users: organisers and attendees. Organisers can log in, create or edit movie screenings,
set ticket types, and manage screening times. Attendees can view available screenings, book
tickets, and leave reviews after attending.

The app uses Node.js, Express, EJS templates, and SQLite as the database. The data is stored
in tables like screenings, organisers, screening_times, bookings, and comments.

Routes are split between organiser and attendee:
-    Organisers have routes for login, register, creating/editing screenings, settings, and
logout.
-    Attendees can view all screenings, see screening details, book tickets, and submit
comments.

The pages are styled using CSS files in /public/css, and templates are written in EJS. Each
screening can have multiple dates and times, which are stored in a separate table
(screening_times) linked by foreign key.

This app includes full CRUD features for screenings and secure user session handling
for organisers. The project also includes form validation and feedback for user actions. The
main extension is password-based access control for organisers using secure sessions.


#### Installation requirements ####

* NodeJS 
    - follow the install instructions at https://nodejs.org/en/
    - we recommend using the latest LTS version
* Sqlite3 
    - follow the instructions at https://www.tutorialspoint.com/sqlite/sqlite_installation.htm 
    - Note that the latest versions of the Mac OS and Linux come with SQLite pre-installed

#### Using this template ####

This template sets you off in the right direction. To get started:

* Run ```npm install``` from the project directory to install all the node packages.

* Run ```npm run build-db``` to create the database on Mac or Linux 
or run ```npm run build-db-win``` to create the database on Windows

* Run ```npm run start``` to start serving the web app (Access via http://localhost:3000)

Test the app by browsing to the following routes:

* http://localhost:3000
* http://localhost:3000/users/list-users
* http://localhost:3000/users/add-user

You can also run: 
```npm run clean-db``` to delete the database on Mac or Linux before rebuilding it for a fresh start
```npm run clean-db-win``` to delete the database on Windows before rebuilding it for a fresh start

Please also read the document ```Working with this Template.pdf``` for further guidance.

##### Creating database tables #####

* All database tables should created by modifying the db_schema.sql 
* This allows us to review and recreate your database simply by running ```npm run build-db```
* Do NOT create or alter database tables through other means


