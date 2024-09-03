const mysql = require('mysql');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

const twilio = require('twilio');


exports.deletebook = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Check if the book is currently borrowed
        connection.query('SELECT * FROM rent WHERE bookId = ? AND status = ?', [req.params.id, 'active'], (err, rentData) => {
            if (err) {
                connection.release();
                console.error('Error checking active rentals:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (rentData.length > 0) {
                connection.release();
                return res.render('book-home', { alert: 'Cannot archive book. It is currently borrowed.', isAlertSuccess: false });
            }

            // If the book is not currently borrowed, proceed with archiving
            connection.query('UPDATE books SET status = ? WHERE bookId = ?', ['archived', req.params.id], (err, data) => {
                connection.release();
                if (!err) {
                    res.render('book-home', { alert: 'Book archived successfully', isAlertSuccess: true });
                } else {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                }
                console.log('The data is: \n', data);
            });
        });
    });
};


exports.permaDeleteBook = (req, res) => {
    const bookId = req.params.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        // Delete related entries in the returntable table
        const deleteReturnQuery = 'DELETE FROM returntable WHERE borrowId IN (SELECT borrowId FROM rent WHERE bookId = ?)';
        connection.query(deleteReturnQuery, [bookId], (err, returnResult) => {
            if (err) {
                connection.release();
                console.error('Error deleting related data in returntable:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Proceed with deleting related entries in the rent table
            const deleteRentQuery = 'DELETE FROM rent WHERE bookId = ?';
            connection.query(deleteRentQuery, [bookId], (err, rentResult) => {
                if (err) {
                    connection.release();
                    console.error('Error deleting related data in rent:', err);
                    return res.status(500).send('Internal Server Error');
                }

                // Finally, delete the book
                const deleteBookQuery = 'DELETE FROM books WHERE bookId = ?';
                connection.query(deleteBookQuery, [bookId], (err, bookResult) => {
                    connection.release();
                    if (err) {
                        console.error(err);
                        return res.render('book-archived', { alert: 'Failed to delete book!', isAlertSuccess: false });
                    }

                    if (bookResult.affectedRows > 0) {
                        return res.render('book-archived', { alert: 'Book deleted successfully!', isAlertSuccess: true });
                    } else {
                        return res.render('book-archived', { alert: 'Failed to delete book!', isAlertSuccess: false });
                    }
                });
            });
        });
    });
};

    
    exports.unarchiveBook = (req,res) =>{

        pool.getConnection((err, connection) => {
            if(err) throw err;
    
            connection.query('UPDATE books SET status = ? WHERE bookId = ?',['active',req.params.id], (err, data) => {
                connection.release();
                if(!err){
                    res.redirect('/viewarchbook');
                }
                else{
                    console.log(err);
                }
                console.log('The data is: \n', data);
    
            });
        });
    };
    
        exports.deleterent = (req,res) => {
            
            pool.getConnection((err, connection) => {
                if(err) throw err;
        
                connection.query('UPDATE rent SET status = ? WHERE borrowId = ?',['archived',req.params.borrowId], (err, data) => {
                    connection.release();
                    if(!err){
                        res.redirect('/viewrent');
                    }
                    else{
                        console.log(err);
                    }
                    console.log('The data is: \n', data);
        
                });
            });
        };

        exports.unarchiveRent = (req,res) =>{

            pool.getConnection((err, connection) => {
                if(err) throw err;
        
                connection.query('UPDATE rent SET status = ? WHERE borrowId = ?',['active',req.params.id], (err, data) => {
                    connection.release();
                    if(!err){
                        res.redirect('/viewarchrent');
                    }
                    else{
                        console.log(err);
                    }
                    console.log('The data is: \n', data);
        
                });
            });
        };

        exports.viewbook = (req, res) => {
            pool.getConnection((err, connection) => {
                if (err) throw err;
        
                console.log('Connected as ID' + connection.threadId);
        
                connection.query('SELECT * FROM books WHERE status != ?', ['archived'], (err, data) => {
                    connection.release();
                    if (!err) {
                        res.render('book-home', { data });
                    } else {
                        console.log(err);
                    }
                    console.log('The data is: \n', data);
                });
            });
        };
        


exports.viewuserbook = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID' + connection.threadId);

        // Use Promise.all to run all queries concurrently
        Promise.all([
            // Query to retrieve all books with status "active"
            new Promise((resolve, reject) => {
                connection.query('SELECT * FROM books WHERE status = "active"', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            }),
            // Query to retrieve distinct sections
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT section FROM books WHERE status = "active" LIMIT 10', (err, sections) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(sections);
                    }
                });
            }),
            // Query to retrieve distinct subjects
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT subject FROM books WHERE status = "active" LIMIT 10', (err, subjects) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(subjects);
                    }
                });
            }),
            // Query to retrieve distinct publication years
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT YEAR(publicationDate) as publicationYear FROM books WHERE status = "active" LIMIT 10', (err, publicationYears) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(publicationYears.map(year => year.publicationYear));
                    }
                });
            }),
        ])
            .then(([data, sections, subjects, publicationYears]) => {
                // Render the user-book-home page with all retrieved data and dropdown options
                res.render('user-book-home', { data, sections, subjects, publicationYears });
            })
            .catch(error => {
                console.error(error);
                res.status(500).send('Internal Server Error');
            })
            .finally(() => {
                // Always release the connection in the finally block
                connection.release();
            });
    });
};


exports.viewcirculation = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Circulation"', (err, data) => {
            connection.release();
            if(!err){
                res.render('circulation', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewfilipiniana = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Filipiniana"', (err, data) => {
            connection.release();
            if(!err){
                res.render('filipiniana', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewfiction = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Fiction"', (err, data) => {
            connection.release();
            if(!err){
                res.render('fiction', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewgeneralities = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Generalities"', (err, data) => {
            connection.release();
            if(!err){
                res.render('generalities', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewphilosophy = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Philosophy"', (err, data) => {
            connection.release();
            if(!err){
                res.render('philosophy', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewreligion = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Religion"', (err, data) => {
            connection.release();
            if(!err){
                res.render('religion', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewsocialci = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Social Science"', (err, data) => {
            connection.release();
            if(!err){
                res.render('social-science', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewlanguages = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Languages"', (err, data) => {
            connection.release();
            if(!err){
                res.render('languages', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewnaturalsci = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Natural Science"', (err, data) => {
            connection.release();
            if(!err){
                res.render('natural-science', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewappliedsci = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Applied Science"', (err, data) => {
            connection.release();
            if(!err){
                res.render('applied-science', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewarts = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Arts and Recreation"', (err, data) => {
            connection.release();
            if(!err){
                res.render('arts-and-recreate', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewgeoandhisto = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Geography and History"', (err, data) => {
            connection.release();
            if(!err){
                res.render('geo-and-histo', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewavm = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section IN ("DVD", "CD")', (err, data) => {
            connection.release();
            if(!err){
                res.render('avm', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewcd = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "CD"', (err, data) => {
            connection.release();
            if(!err){
                res.render('cd', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};
exports.viewjournal = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Journal"', (err, data) => {
            connection.release();
            if(!err){
                res.render('journal', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};
exports.viewmagazine = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Magazine"', (err, data) => {
            connection.release();
            if(!err){
                res.render('magazine', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};
exports.viewnews = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Magazine"', (err, data) => {
            connection.release();
            if(!err){
                res.render('newspaper', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.viewreference = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "active" AND section = "Reference"', (err, data) => {
            connection.release();
            if(!err){
                res.render('reference', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};

exports.bookInventory = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        console.log('Connected as ID' + connection.threadId);

        // Use Promise.all to run all queries concurrently
        Promise.all([
            // Query to retrieve all books
            new Promise((resolve, reject) => {
                connection.query('SELECT * FROM books', (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            }),
            // Query to retrieve distinct sections
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT section FROM books', (err, sections) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(sections);
                    }
                });
            }),
            // Query to retrieve distinct subjects
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT subject FROM books', (err, subjects) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(subjects);
                    }
                });
            }),
            // Query to retrieve distinct publishers
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT publisher FROM books', (err, publishers) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(publishers);
                    }
                });
            }),
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT subjectLoc FROM books', (err, subjectLocs) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(subjectLocs);
                    }
                });
            }),
            // Query to retrieve distinct formats
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT format FROM books', (err, formats) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(formats);
                    }
                });
            }),
            // Query to retrieve distinct acquisition sources
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT acquisitionSource FROM books', (err, acquisitionSources) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(acquisitionSources);
                    }
                });
            }),
            // Query to retrieve distinct statuses
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT status FROM books', (err, statuses) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(statuses);
                    }
                });
            }),
            // Query to retrieve distinct publication years
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT YEAR(publicationDate) as publicationYear FROM books', (err, publicationYears) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(publicationYears.map(year => year.publicationYear));
                    }
                });
            }),
            // Query to retrieve distinct acquisition years
            new Promise((resolve, reject) => {
                connection.query('SELECT DISTINCT YEAR(acquisitionDate) as acquisitionYear FROM books', (err, acquisitionYears) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(acquisitionYears.map(year => year.acquisitionYear));
                    }
                });
            }),
            // Query to retrieve total count of all books
            new Promise((resolve, reject) => {
                connection.query('SELECT COUNT(*) as totalCount FROM books', (err, totalCount) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(totalCount[0].totalCount);
                    }
                });
            }),
            // Query to retrieve total copies of all books
            new Promise((resolve, reject) => {
                connection.query('SELECT SUM(copies) as totalCopies FROM books', (err, totalCopies) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(totalCopies[0].totalCopies);
                    }
                });
            })
        ])
        .then(([data, sections, subjects, publishers, subjectLocs, formats, acquisitionSources, statuses, publicationYears, acquisitionYears, totalCount, totalCopies]) => {
            // Render the book-inventory page with all retrieved data
            res.render('book-inventory', { data, sections, subjects, subjectLocs, publishers, formats, acquisitionSources, statuses, publicationYears, acquisitionYears, totalCount, totalCopies });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Internal Server Error');
        })
        .finally(() => {
            // Always release the connection in the finally block
            connection.release();
        });
    });
};



exports.filterUserBooks = (req, res) => {
    const { section, subject, publicationYear } = req.body;

    const filterQuery = `
        SELECT *
        FROM books
        WHERE
        (LOWER(section) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) 
        OR YEAR(publicationDate) = ?);
    `;

    pool.query(filterQuery, [section, subject, publicationYear], (err, data) => {
        if (!err) {
            // Render the user-side view with the filtered data
            res.render('user-book-home', { data });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    });
};


exports.bookCollections = (req,res) => {
    
    res.render('book-collection');
};

exports.avmCollections = (req,res) => {
    
    res.render('avm');
};
exports.periodicalCollections = (req,res) => {
    
    res.render('periodical-sec');
};
exports.technical = (req,res) => {
    
    res.render('technical');
};
exports.circulation = (req,res) => {
    
    res.render('circulation-opt');
};

exports.viewarchbook = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM books WHERE status = "archived"', (err, data) => {
            connection.release();
            if(!err){
                res.render('book-archived', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
};



exports.viewrent = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const query = `
        SELECT rent.*, userlogin.first_name, userlogin.last_name, userlogin.username, userlogin.contact, books.isbn, books.title
        FROM rent
        JOIN userlogin ON rent.userloginId = userlogin.userloginId
        JOIN books ON rent.bookId = books.bookId
        WHERE rent.status = 'active'
        ORDER BY rent.borrow_date;`;
        connection.query(query, (err, data) => {
            connection.release();
            if (!err) {
                res.render('rent-home', { data });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};



exports.viewarchrent = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const query = `
            SELECT rent.*, userlogin.first_name, userlogin.last_name, userlogin.username, userlogin.contact, books.isbn, books.title
            FROM rent
            JOIN userlogin ON rent.userloginId = userlogin.userloginId
            JOIN books ON rent.bookId = books.bookId
            WHERE rent.status = 'archived'`;
        connection.query(query, (err, data) => {
            connection.release();
            if (!err) {
                res.render('rent-archived', { data });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};

exports.viewreturned = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const query = `
            SELECT returntable.returnId, returntable.actual_return_date, returntable.status,
                   userlogin.first_name, userlogin.last_name, userlogin.contact,
                   books.isbn, books.title, rent.borrow_date
            FROM returntable
            LEFT JOIN userlogin ON returntable.userloginId = userlogin.userloginId
            LEFT JOIN books ON returntable.bookId = books.bookId
            LEFT JOIN rent ON returntable.borrowId = rent.borrowId`;

        connection.query(query, (err, data) => {
            connection.release();
            if (!err) {
                res.render('return-home', { data });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};


exports.viewuserreturned = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const userloginId = req.session.user.userloginId;

        const query = `
            SELECT returntable.returnId, returntable.actual_return_date, returntable.status,
                   userlogin.first_name, userlogin.last_name, userlogin.contact,
                   books.isbn, books.title, rent.borrow_date
            FROM returntable
            LEFT JOIN userlogin ON returntable.userId = userlogin.userloginId
            LEFT JOIN books ON returntable.bookId = books.bookId
            LEFT JOIN rent ON returntable.borrowId = rent.borrowId
            WHERE userlogin.userloginId = ?`; 

        connection.query(query, [userloginId], (err, data) => {
            connection.release();
            if (!err) {
                res.render('user-return-home', { data });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};

exports.librariansearch = (req, res) => {
    const subject = req.body.subject;
    const queue = `
        SELECT *
        FROM books
        WHERE
    (LOWER(isbn) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?) OR LOWER(subtitle) LIKE LOWER(?) OR LOWER(edition) LIKE LOWER(?) 
    OR LOWER(seriesTitle) LIKE LOWER(?) OR LOWER(genre) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(section) LIKE LOWER(?) 
    OR LOWER(collectionCode) LIKE LOWER(?) OR LOWER(callNumber) LIKE LOWER(?) OR LOWER(authorCutter) LIKE LOWER(?) 
    OR LOWER(pubYear) LIKE LOWER(?) OR LOWER(main_author) LIKE LOWER(?) OR LOWER(secondary_authors) LIKE LOWER(?) 
    OR LOWER(responsibility) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?) OR LOWER(publicationPlace) LIKE LOWER(?) 
    OR LOWER(publicationDate) LIKE LOWER(?) OR LOWER(pages) LIKE LOWER(?) OR LOWER(notes) LIKE LOWER(?) OR LOWER(summary) LIKE LOWER(?) 
    OR LOWER(copies) LIKE LOWER(?) OR LOWER(format) LIKE LOWER(?) OR LOWER(acquisitionDate) LIKE LOWER(?) OR LOWER(acquisitionSource) LIKE LOWER(?) 
    OR LOWER(barcode) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?));
`;

    pool.query(queue, getSearchValues(req), (err, data) => {
        if (!err) {
            res.render('book-inventory', { data });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    });
    
};


exports.usersearch = (req, res) => {
    const queue = `
        SELECT *
        FROM books
        WHERE
    (LOWER(isbn) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?) OR LOWER(subtitle) LIKE LOWER(?) OR LOWER(edition) LIKE LOWER(?) 
    OR LOWER(seriesTitle) LIKE LOWER(?) OR LOWER(genre) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(section) LIKE LOWER(?) 
    OR LOWER(collectionCode) LIKE LOWER(?) OR LOWER(callNumber) LIKE LOWER(?) OR LOWER(authorCutter) LIKE LOWER(?) 
    OR LOWER(pubYear) LIKE LOWER(?) OR LOWER(main_author) LIKE LOWER(?) OR LOWER(secondary_authors) LIKE LOWER(?) 
    OR LOWER(responsibility) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?) OR LOWER(publicationPlace) LIKE LOWER(?) 
    OR LOWER(publicationDate) LIKE LOWER(?) OR LOWER(pages) LIKE LOWER(?) OR LOWER(notes) LIKE LOWER(?) OR LOWER(summary) LIKE LOWER(?) 
    OR LOWER(copies) LIKE LOWER(?) OR LOWER(format) LIKE LOWER(?) OR LOWER(acquisitionDate) LIKE LOWER(?) OR LOWER(acquisitionSource) LIKE LOWER(?) 
    OR LOWER(barcode) LIKE LOWER(?))
    AND status = 'active';
`;

    pool.query(queue, getSearchValues(req), (err, data) => {
        if (!err) {
            res.render('user-book-home', { data });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    });
};

const getSearchValues = (req) => {
    let searchValue = req.body.search;
    console.log('Search Value:', searchValue);
    return Array.from({ length: 29 }, () => `%${searchValue}%`);
};


exports.search = (req, res) => {
    const role = req.session.user.role;

    if (role === 'librarian') {
        exports.librariansearch(req, res);
    } else {
        exports.usersearch(req, res);
    }
};



exports.librarianbooksearch = (req, res) => {
    const queue = `
        SELECT *
        FROM books
        WHERE
    (LOWER(isbn) LIKE LOWER(?) OR LOWER(title) LIKE LOWER(?) OR LOWER(subtitle) LIKE LOWER(?) OR LOWER(edition) LIKE LOWER(?) 
    OR LOWER(seriesTitle) LIKE LOWER(?) OR LOWER(genre) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(section) LIKE LOWER(?) 
    OR LOWER(collectionCode) LIKE LOWER(?) OR LOWER(callNumber) LIKE LOWER(?) OR LOWER(authorCutter) LIKE LOWER(?) 
    OR LOWER(pubYear) LIKE LOWER(?) OR LOWER(main_author) LIKE LOWER(?) OR LOWER(secondary_authors) LIKE LOWER(?) 
    OR LOWER(responsibility) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?) OR LOWER(publicationPlace) LIKE LOWER(?) 
    OR LOWER(publicationDate) LIKE LOWER(?) OR LOWER(pages) LIKE LOWER(?) OR LOWER(notes) LIKE LOWER(?) OR LOWER(summary) LIKE LOWER(?) 
    OR LOWER(copies) LIKE LOWER(?) OR LOWER(format) LIKE LOWER(?) OR LOWER(acquisitionDate) LIKE LOWER(?) OR LOWER(acquisitionSource) LIKE LOWER(?) 
    OR LOWER(barcode) LIKE LOWER(?));
`;

    pool.query(queue, searchBookList(req), (err, data) => {
        if (!err) {
            res.render('book-home', { data });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    });
    
};

const searchBookList = (req) => {
    let searchValue = req.body.search;
    console.log('Search Value:', searchValue);
    return Array.from({ length: 28 }, () => `%${searchValue}%`);
};


exports.booklistsearch = (req, res) => {
    const role = req.session.user.role;

    if (role === 'librarian') {
        exports.librarianbooksearch(req, res);
    } else {
        exports.usersearch(req, res);
    }
};




exports.filterBooks = (req, res) => {
    const {
        section,
        subject,
        publisher,
        subjectLoc,
        publicationYear,
        acquisitionYear,
        format,
        acquisitionSource,
        status
    } = req.body;

    const filterQuery = `
        SELECT *,
        (SELECT COUNT(*) FROM books WHERE
        (LOWER(section) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?)  OR LOWER(subjectLoc) LIKE LOWER(?) OR YEAR(publicationDate) = ? OR YEAR(acquisitionDate) = ? OR LOWER(format) LIKE LOWER(?) 
        OR LOWER(acquisitionSource) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?))) as totalCount,
        (SELECT SUM(copies) FROM books WHERE
        (LOWER(section) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?)  OR LOWER(subjectLoc) LIKE LOWER(?) OR YEAR(publicationDate) = ? OR YEAR(acquisitionDate) = ? OR LOWER(format) LIKE LOWER(?) 
        OR LOWER(acquisitionSource) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?))) as totalCopies
        FROM books
        WHERE
        (LOWER(section) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(publisher) LIKE LOWER(?)  OR LOWER(subjectLoc) LIKE LOWER(?) OR YEAR(publicationDate) = ? OR YEAR(acquisitionDate) = ? OR LOWER(format) LIKE LOWER(?) 
        OR LOWER(acquisitionSource) LIKE LOWER(?) OR LOWER(status) LIKE LOWER(?));
    `;

    pool.query(filterQuery, [section, subject, publisher, subjectLoc, publicationYear, acquisitionYear, format, acquisitionSource, status,
                             section, subject, publisher, subjectLoc, publicationYear, acquisitionYear, format, acquisitionSource, status,
                             section, subject, publisher, subjectLoc, publicationYear, acquisitionYear, format, acquisitionSource, status], (err, data) => {
        if (!err) {
            const totalCount = data.length > 0 ? data[0].totalCount : 0;
            const totalCopies = data.length > 0 ? data[0].totalCopies : 0;
            res.render('book-inventory', { data, totalCount, totalCopies });
        } else {
            console.error(err);
            res.status(500).send('Internal Server Error');
        }
    });
};






exports.sortByAcquisitionDate = (req, res) => {
    const role = req.session.user.role;
    if (role !== 'librarian') {
        return res.status(403).send('Forbidden');
    }

    const startDate = req.body.startDate;
    const endDate = req.body.endDate;

    const sortQuery = `
        SELECT *
        FROM books
        WHERE
            (isbn LIKE ? OR title LIKE ? OR subtitle LIKE ? OR authors LIKE ? 
            OR responsibility LIKE ? OR edition LIKE ? OR seriesTitle LIKE ? 
            OR genre LIKE ? OR callNumber LIKE ? OR section LIKE ? 
            OR publisher LIKE ? OR publicationPlace LIKE ? OR publicationDate LIKE ? 
            OR pages LIKE ? OR notes LIKE ? OR copies LIKE ? OR format LIKE ? 
            OR acquisitionDate BETWEEN ? AND ?)
            AND status = 'active'
        ORDER BY acquisitionDate DESC`;

    const searchValues = getSearchValues(req);
    const valuesWithDate = [...searchValues, startDate, endDate];

    pool.query(sortQuery, valuesWithDate, (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        } else {
            res.render('book-home', { data });
        }
    });
};



exports.displaynewbook = (req, res) => {
    res.render('add-book', { formData: {} });
};



exports.cataloging = (req,res) => {
    res.render('add-book');
};

exports.displaynewrent = (req,res) => {
    res.render('add-rent');
};

exports.addbook = (req, res) => {
    const {
        isbn,
        title,
        subtitle,
        edition,
        seriesTitle,
        genre,
        subject,
        section,
        collectionCode,
        subjectLoc,
        callNumber,                      
        authorCutter,
        pubYear,
        main_author,
        sec_author,
        responsibility,
        publisher,
        publicationPlace,
        publicationDate,
        pages,
        notes,
        summary,
        copies,
        format,
        acquisitionDate,
        acquisitionSource,
        barcode
    } = req.body;

    // Combine main and secondary authors into a single array
    const authors = [main_author, ...(sec_author || [])];

    // Check if barcode already exists in the database
    const checkBarcodeQuery = 'SELECT COUNT(*) AS count FROM Books WHERE barcode = ?';

    // If barcode is unique, proceed with inserting the book
    const insertBookQuery = `
        INSERT INTO Books (
            isbn,
            title,
            subtitle,
            edition,
            seriesTitle,
            genre,
            subject,
            section,
            collectionCode,
            subjectLoc,
            callNumber,
            authorCutter,
            pubYear,
            main_author,
            secondary_authors,
            responsibility,
            publisher,
            publicationPlace,
            publicationDate,
            pages,
            notes,
            summary,
            copies,
            format,
            acquisitionDate,
            acquisitionSource,
            barcode
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Check if barcode already exists
        connection.query(checkBarcodeQuery, [barcode], (err, result) => {
            if (err) {
                connection.release();
                console.error('Error checking barcode:', err);
                return res.render('add-book', { alert: 'Internal Server Error', isAlertSuccess: false, formData: req.body });
            }

            const barcodeCount = result[0].count;

            if (barcodeCount > 0) {
                connection.release();
                console.log('Request Body:', req.body);
                return res.render('add-book', { alert: 'Duplicate barcode. Please use a unique barcode.', isAlertSuccess: false, formData: req.body });
            }

            // If barcode is unique, proceed with inserting the book
            connection.query(
                insertBookQuery,
                [
                    isbn,
                    title,
                    subtitle,
                    edition,
                    seriesTitle,
                    genre,
                    subject,
                    section,
                    collectionCode,
                    subjectLoc,
                    callNumber,                      
                    authorCutter,
                    pubYear,
                    authors[0], // main_author
                    JSON.stringify(authors.slice(1)), // secondary_authors as JSON string
                    responsibility,
                    publisher,
                    publicationPlace,
                    publicationDate,
                    pages,
                    notes,
                    summary,
                    copies,
                    format,
                    acquisitionDate,
                    acquisitionSource,
                    barcode
                ],
                (err, result) => {
                    connection.release();
                    if (err) {
                        console.error('Error inserting into Books table:', err);
                        return res.render('add-book', { alert: 'Internal Server Error', isAlertSuccess: false, formData: req.body });
                    }

                    res.render('add-book', { alert: 'Book added successfully', isAlertSuccess: true, formData: {} });
                }
            );
        });
    });
};









exports.editbook = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        connection.query('SELECT * FROM Books WHERE bookId = ?', [req.params.id], (err, data) => {
            connection.release();
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            if (!data || data.length === 0) {
                return res.status(404).send('Book not found');
            }

            // Parse the secondary_authors field as an array
            data[0].secondary_authors = data[0].secondary_authors ? data[0].secondary_authors.split(',') : [];

            res.render('edit-book', { data });
        });
    });
};


exports.viewbookall = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        connection.query('SELECT * FROM Books WHERE bookId = ?', [req.params.id], (err, data) => {
            connection.release();
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            if (!data || data.length === 0) {
                return res.status(404).send('Book not found');
            }

            // Parse the secondary_authors field as an array
            data[0].secondary_authors = data[0].secondary_authors ? data[0].secondary_authors.split(',') : [];

            res.render('view-book', { data });
        });
    });
};



exports.addrent = (req, res) => {
    const { barcode, username, borrow_date, return_date } = req.body;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        // Check if the user details (username) are correct
        const checkUserQuery = 'SELECT * FROM userlogin WHERE username = ?';
        connection.query(checkUserQuery, [username], (err, userData) => {
            if (err) {
                connection.release();
                console.error('Error in checkUserQuery:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (userData.length === 0) {
                connection.release();
                return res.render('add-rent', { alert: 'Incorrect username!' });
            }

            // If the user details are correct, check if the book is available (status = 'active') based on barcode
            const checkBookQuery = 'SELECT * FROM books WHERE barcode = ? AND status = "active" AND copies > 0';
            connection.query(checkBookQuery, [barcode], (err, bookData) => {
                if (err) {
                    connection.release();
                    console.error('Error in checkBookQuery:', err);
                    return res.status(500).send('Internal Server Error');
                }

                if (bookData.length === 0) {
                    connection.release();
                    return res.render('add-rent', { alert: 'Incorrect Barcode or No copies available for borrowing!' });
                }

                // If the book is available, update the status to 'borrowed' for one copy
                const bookId = bookData[0].bookId;
                const copiesRemaining = bookData[0].copies - 1;

                const updateBookQuery = 'UPDATE books SET copies = ? WHERE bookId = ?';
                connection.query(updateBookQuery, [copiesRemaining, bookId], (err, updateResult) => {
                    if (err || updateResult.affectedRows === 0) {
                        connection.release();
                        console.log(err);
                        return res.status(500).send('Internal Server Error or No copies available for borrowing');
                    }

                    // Check if the remaining copies are zero, then update the status to 'unavailable'
                    if (copiesRemaining === 0) {
                        const updateStatusQuery = 'UPDATE books SET status = "unavailable" WHERE bookId = ?';
                        connection.query(updateStatusQuery, [bookId], (err) => {
                            if (err) {
                                connection.release();
                                console.log(err);
                                return res.status(500).send('Internal Server Error');
                            }

                            connection.release();
                            res.render('add-rent', { alert: 'Book borrowed successfully, no more copies available', isAlertSuccess: true });
                        });
                    } else {
                        // Insert the borrowing information into the rent table
                        const insertRentQuery = `
                            INSERT INTO rent (borrow_date, return_date, userloginId, bookId)
                            VALUES (?, ?, ?, ?)`;
                        connection.query(
                            insertRentQuery,
                            [borrow_date, return_date, userData[0].userloginId, bookId],
                            (err, result) => {
                                connection.release();
                                if (err) {
                                    console.log(err);
                                    return res.status(500).send('Internal Server Error');
                                }

                                res.render('add-rent', { alert: 'Book borrowed successfully', isAlertSuccess: true });
                            }
                        );
                    }
                });
            });
        });
    });
};


exports.borrowBook = (req, res) => {
    const userloginId = req.session.user.userloginId;
    const bookId = req.params.bookId;

    // Check if the book is available (status = 'active' and copies > 0)
    const checkAvailabilityQuery = 'SELECT * FROM books WHERE bookId = ? AND status = "active" AND copies > 0';

    pool.query(checkAvailabilityQuery, [bookId], (err, bookResults) => {
        if (err) {
            console.error('Error checking book availability:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (bookResults.length === 0) {
            return res.status(404).send('Book not available for borrowing');
        }

        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);
        returnDate.setDate(returnDate.getDate() + 3);

        // Update copies in the books table
        const updateCopiesQuery = 'UPDATE books SET copies = copies - 1 WHERE bookId = ? AND copies > 0';
        pool.query(updateCopiesQuery, [bookId], (err, updateResult) => {
            if (err || updateResult.affectedRows === 0) {
                console.error('Error updating book copies:', err);
                return res.status(500).send('Internal Server Error or No copies available for borrowing');
            }

            // Insert into rent table
            const borrowBookQuery = 'INSERT INTO rent (userloginId, bookId, borrow_date, return_date) VALUES (?, ?, ?, ?)';
            pool.query(borrowBookQuery, [userloginId, bookId, borrowDate, returnDate], (err) => {
                if (err) {
                    console.error('Error borrowing book:', err);
                    return res.status(500).send('Internal Server Error');
                }

                // Check if all copies are borrowed, then update status to 'unavailable'
                const checkAllCopiesBorrowedQuery = 'SELECT COUNT(*) AS availableCopies FROM books WHERE bookId = ? AND copies > 0';
                pool.query(checkAllCopiesBorrowedQuery, [bookId], (err, countResult) => {
                    if (err) {
                        console.error('Error checking available copies:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    if (countResult[0].availableCopies === 0) {
                        // All copies are borrowed, update status to 'unavailable'
                        const updateBookStatusQuery = 'UPDATE books SET status = "unavailable" WHERE bookId = ?';
                        pool.query(updateBookStatusQuery, [bookId], (err) => {
                            if (err) {
                                console.error('Error updating book status:', err);
                                return res.status(500).send('Internal Server Error');
                            }

                            res.render('user-book-home', { alert: 'Book borrowed successfully', isAlertSuccess: true });
                        });
                    } else {
                        // Some copies are still available, no need to update status
                        res.render('user-book-home', { alert: 'Book borrowed successfully', isAlertSuccess: true });
                    }
                });
            });
        });
    });
};





exports.returnBook = (req, res) => {
    const borrowId = req.params.borrowId;

    const getBookDetailsQuery = 'SELECT * FROM rent WHERE borrowId = ?';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        connection.query(getBookDetailsQuery, [borrowId], (err, bookDetails) => {
            if (err) {
                connection.release();
                console.error('Error fetching book details:', err);
                return res.status(500).send('Internal Server Error');
            }

            console.log('Book Details:', bookDetails);

            if (bookDetails.length === 0 || !bookDetails[0].borrowId) {
                connection.release();
                return res.status(404).send('Book not found or already returned');
            }

            const book = bookDetails[0];

            // Check if borrowId is not null in the rent table
            if (!book.borrowId) {
                connection.release();
                return res.status(404).send('Book not found or already returned');
            }

            // Update the status of the book in the rent table
            const updateStatusQuery = 'UPDATE rent SET status = "returned" WHERE borrowId = ?';
            connection.query(updateStatusQuery, [borrowId], (err, result) => {
                if (err) {
                    connection.release();
                    console.error('Error updating book status:', err);
                    return res.status(500).send('Internal Server Error');
                }

                // Check if any rows were affected
                if (result.affectedRows === 0) {
                    connection.release();
                    return res.status(404).send('Book not found or already returned');
                }

                // Update the status of the book in the books table to "active"
                const updateBookStatusQuery = 'UPDATE books SET status = "active", copies = copies + 1 WHERE bookId = ?';
                connection.query(updateBookStatusQuery, [book.bookId], (err) => {
                    if (err) {
                        connection.release();
                        console.error('Error updating book status in books table:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    // Insert the returned book information into the returntable
                    const insertIntoReturnTableQuery = `
                        INSERT INTO returntable (actual_return_date, status, userloginId, bookId, borrowId)
                        VALUES (?, ?, ?, ?, ?)`;
                    connection.query(
                        insertIntoReturnTableQuery,
                        [new Date(), 'returned', book.userloginId, book.bookId, borrowId],
                        (err) => {
                            connection.release();

                            if (err) {
                                console.error('Error inserting into returntable:', err);
                                return res.status(500).send('Internal Server Error');
                            }

                            res.render('user-view-rented', { alert: 'Book returned successfully', isAlertSuccess: true }); 
                        }
                    );
                });
            });
        });
    });
};



exports.renewBook = (req, res) => {
    const borrowId = req.params.borrowId;

    const getBookDetailsQuery = 'SELECT * FROM rent WHERE borrowId = ?';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        connection.query(getBookDetailsQuery, [borrowId], (err, bookDetails) => {
            if (err) {
                connection.release();
                console.error('Error fetching book details:', err);
                return res.status(500).send('Internal Server Error');
            }

            console.log('Book Details:', bookDetails);

            if (bookDetails.length === 0 || !bookDetails[0].borrowId) {
                connection.release();
                return res.status(404).send('Book not found or already returned');
            }

            const book = bookDetails[0];
            if (!book.borrowId) {
                connection.release();
                return res.status(404).send('Book not found or already returned');
            }

            const renewDays = 3;
            const newDueDate = new Date();
            newDueDate.setDate(newDueDate.getDate() + renewDays);

            console.log('Current date:', new Date());
            console.log('New due date:', newDueDate);

            const updateDueDateQuery = 'UPDATE rent SET return_date = ? WHERE borrowId = ?';
            
            connection.query(updateDueDateQuery, [newDueDate, borrowId], (err, result) => {
                if (err) {
                    connection.release();
                    console.error('Error updating return date:', err);
                    return res.status(500).send('Internal Server Error');
                }

                if (result.affectedRows === 0) {
                    connection.release();
                    return res.status(404).send('Book not found or unable to renew');
                }

                res.render('user-view-rented', { alert: 'Book renewed successfully', isAlertSuccess: true });
                connection.release();
            });
        });
    });
};


const accountSidDefault = process.env.accountSidDefault; 
const authTokenDefault = process.env.authTokenDefault; 
const twilioPhoneNumberDefault = process.env.twilioPhoneNumberDefault;
const clientDefault = twilio(accountSidDefault, authTokenDefault);

function sendTwilioNotification(phoneNumber, bookTitle, returnDate, res) {
    const formattedPhoneNumber = `+${phoneNumber}`;

    const userTwilioInfo = {
        accountSid: accountSidDefault,
        authToken: authTokenDefault,
        twilioPhoneNumber: twilioPhoneNumberDefault
    };

    const client = twilio(userTwilioInfo.accountSid, userTwilioInfo.authToken);

    const messageBody = `This is Cuyapo Library, your borrowed book ${bookTitle}, due date is on ${returnDate}.`;

    client.messages
        .create({
            body: messageBody,
            from: userTwilioInfo.twilioPhoneNumber,
            to: formattedPhoneNumber,
        })
        .then((message) => {
            console.log(message.sid);
            res.render('user-view-rented', { alert: 'Notification sent successfully', isAlertSuccess: true });
        })
        .catch((error) => {
            console.error('Twilio error:', error);
            res.render('user-view-rented', { alert: 'Error sending notification', isAlertSuccess: false });
        });
};


exports.notifyUser = (req, res) => {
    const userId = req.params.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.log('Error getting connection:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const userQuery = `
    SELECT ul.contact, b.title, r.return_date 
    FROM rent r
    JOIN books b ON r.bookId = b.bookId 
    JOIN userlogin ul ON r.userloginId = ul.userloginId 
    WHERE r.userloginId = ? AND r.status = 'active'
`;

        connection.query(userQuery, [userId], (err, userData) => {
            if (err) {
                connection.release();
                console.log('Error executing query:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            if (userData.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'No borrowed books found for this user' });
            }

            const phoneNumber = userData[0].contact;
            const bookTitle = userData[0].title;
            const returnDate = userData[0].return_date;

            sendTwilioNotification(phoneNumber, bookTitle, returnDate, res);

            connection.release();
        });
    });
};



exports.updatebook = (req, res) => {
    const updateQuery = `
        UPDATE Books 
        SET isbn = ?, 
            title = ?, 
            subtitle = ?, 
            edition = ?, 
            seriesTitle = ?, 
            genre = ?, 
            subject = ?, 
            section = ?, 
            collectionCode = ?, 
            subjectLoc = ?, 
            callNumber = ?, 
            authorCutter = ?, 
            pubYear = ?, 
            main_author = ?, 
            secondary_authors = ?, 
            responsibility = ?, 
            publisher = ?, 
            publicationPlace = ?, 
            publicationDate = ?, 
            pages = ?, 
            notes = ?, 
            summary = ?, 
            copies = ?, 
            format = ?, 
            acquisitionDate = ?, 
            acquisitionSource = ?, 
            barcode = ?
        WHERE bookId = ?`;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        const {
            isbn,
            title,
            subtitle,
            edition,
            seriesTitle,
            genre,
            subject,
            section,
            collectionCode,
            subjectLoc,
            callNumber,
            authorCutter,
            pubYear,
            main_author,
            sec_author,
            responsibility,
            publisher,
            publicationPlace,
            publicationDate,
            pages,
            notes,
            summary,
            copies,
            format,
            acquisitionDate,
            acquisitionSource,
            barcode
        } = req.body;

        const authors = [main_author, ...(sec_author || [])];

        const copiesNumber = parseInt(copies, 10);

        const bookStatus = (copiesNumber === 0) ? 'unavailable' : 'active';

        const checkBarcodeQuery = 'SELECT COUNT(*) AS count FROM Books WHERE barcode = ? AND bookId != ?';

        connection.query(checkBarcodeQuery, [barcode, req.params.id], (err, result) => {
            if (err) {
                connection.release();
                console.error('Error checking barcode:', err);
                return res.render('edit-book', { alert: 'Internal Server Error', isAlertSuccess: false });
            }

            const barcodeCount = result[0].count;

            if (barcodeCount > 0) {
                connection.release();
                return res.render('edit-book', { alert: 'Duplicate barcode. Please use a unique barcode.', isAlertSuccess: false });
            }

            connection.query(
                updateQuery,
                [
                    isbn,
                    title,
                    subtitle,
                    edition,
                    seriesTitle,
                    genre,
                    subject,
                    section,
                    collectionCode,
                    subjectLoc,
                    callNumber,
                    authorCutter,
                    pubYear,
                    authors[0], // main_author
                    JSON.stringify(authors.slice(1)), // secondary_authors
                    responsibility,
                    publisher,
                    publicationPlace,
                    publicationDate,
                    pages,
                    notes,
                    summary,
                    copies,
                    format,
                    acquisitionDate,
                    acquisitionSource,
                    barcode,
                    req.params.id
                ],
                (err, data) => {
                    connection.release();

                    if (err) {
                        console.error('Error updating Books table:', err);
                        res.render('edit-book', { data, alert: 'Cannot edit book', isAlertSuccess: false });
                        return res.status(500).send('Internal Server Error');
                    }

                    updateBookStatus(req.params.id, bookStatus);

                    res.render('edit-book', { data, alert: 'Book updated successfully', isAlertSuccess: true });
                }
            );
        });
    });
};

function updateBookStatus(bookId, status) {
    const updateStatusQuery = 'UPDATE Books SET status = ? WHERE bookId = ?';

    pool.query(updateStatusQuery, [status, bookId], (err, result) => {
        if (err) {
            console.error('Error updating book status:', err);
        }
    });
}



