const express = require('express');
const exphbs = require('express-handlebars');
const mysql = require('mysql');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;


app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const handlebars = exphbs.create({
    extname: '.hbs',
    helpers: {
      formatDate: function (dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
      },
    },
  });
  
  
  app.engine('.hbs', handlebars.engine);
  app.set('view engine', '.hbs');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

pool.getConnection((err, connection) => {
    if (err) throw err;
    console.log('Connected as ID' + connection.threadId);
});


const routes = require('./server/routes/user');
app.use('/', routes);

app.listen(port, () => console.log(`Listening on port ${port}`));
