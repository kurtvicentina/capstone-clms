const mysql = require('mysql');
const bcrypt = require('bcrypt');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

const twilio = require('twilio');
const accountSid = 'AC47c7cf3bde2cdc7e1a96baab4bd8b580'; 
const authToken = '008444641ec918369fc6217b58a434a6'; 
const twilioPhoneNumber = '+12055767264';
const client = twilio(accountSid, authToken);



exports.displayRegistration = (req, res) => {
    res.render('register');
};

exports.register = (req, res) => {
    const { username, password, first_name, last_name, contact, librarianKeyPass } = req.body;

    const correctLibrarianKeyPass = 'cuyapoLibrary2024';

    const isLibrarian = librarianKeyPass === correctLibrarianKeyPass;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        const checkUsernameQuery = 'SELECT * FROM userlogin WHERE username = ?';
        connection.query(checkUsernameQuery, [username], (err, usernameData) => {
            if (err) {
                connection.release();
                console.error('Error checking username:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (usernameData.length > 0) {
                connection.release();
                return res.render('register', { alert: 'Username already exists. Please choose a different username.', isAlertSuccess: false });
            }

            if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
                connection.release();
                return res.render('register', { alert: 'Password must be at least 8 characters long and include both upper and lowercase characters.', isAlertSuccess: false });
            }

            if (first_name.length == 0) {
                connection.release();
                return res.render('register', { alert: 'Please enter your first name', isAlertSuccess: false });
            }

            if (last_name.length == 0) {
                connection.release();
                return res.render('register', { alert: 'Please enter your last name', isAlertSuccess: false });
            }

            if (contact.length < 12) {
                connection.release();
                return res.render('register', { alert: 'Please enter your correct contact number', isAlertSuccess: false });
            }

            // Set the role based on librarianKeyPass
            const role = isLibrarian ? 'librarian' : 'user';

            bcrypt.hash(password, 10, (err, hashedPassword) => {
                if (err) {
                    connection.release();
                    throw err;
                }

                const insert = `INSERT INTO userlogin (username, password, first_name, last_name, contact, role) VALUES (?, ?, ?, ?, ?, ?)`;
                connection.query(insert, [username, hashedPassword, first_name, last_name, contact, role], (err, data) => {
                    if (!err) {
                        connection.release();
                        res.render('login', { alert: 'Registration successful!', isAlertSuccess: true });
                    } else {
                        connection.release();
                        console.log(err);
                        return res.status(500).send('Internal Server Error');
                    }
                });
            });
        });
    });
};

exports.permaDeleteUser = (req, res) => {
    const userId = req.params.id;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }

        const checkRentQuery = 'SELECT * FROM rent WHERE userloginId = ? AND status = "active"';
        connection.query(checkRentQuery, [userId], (err, rentData) => {
            if (err) {
                connection.release();
                console.error('Error in checkRentQuery:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (rentData.length > 0) {
                connection.release();
                return res.render('user-archived', { alert: 'User has active rentals. Cannot delete.', isAlertSuccess: false });
            }

            const deleteRelatedDataQuery = 'DELETE FROM returntable WHERE userloginId = ?';
            connection.query(deleteRelatedDataQuery, [userId], (err, result) => {
                if (err) {
                    connection.release();
                    console.error('Error deleting related data:', err);
                    return res.status(500).send('Internal Server Error');
                }

                const deleteUserQuery = 'DELETE FROM userlogin WHERE userloginId = ?';
                connection.query(deleteUserQuery, [userId], (err, result) => {
                    connection.release();

                    if (err) {
                        console.error(err);
                        return res.status(500).send('Internal Server Error');
                    }

                    return res.render('user-archived', { alert: 'User deleted successfully!', isAlertSuccess: true });
                });
            });
        });
    });
};








exports.displayLogin = (req, res) => {
    res.render('login');
};

exports.login = (req, res) => {
    const { username, password } = req.body;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        const query = `SELECT * FROM userlogin WHERE username = ? AND status = 'active'`;
        connection.query(query, [username], (err, data) => {
            connection.release();
            if (err) throw err;

            if (data.length > 0) {
                // Use bcrypt.compare to check if the provided password matches the stored hashed password
                bcrypt.compare(password, data[0].password, (err, result) => {
                    if (result) {
                        req.session.user = {
                            userloginId: data[0].userloginId,
                            username: data[0].username,
                            role: data[0].role,
                        };

                        res.locals.isLibrarian = req.session.user.role === 'librarian';
                        res.locals.isUser = req.session.user.role === 'user';

                        res.redirect('/');
                    } else {
                        res.render('login', { alert: 'Invalid username or password!', user: true, isAlertSuccess: false });
                    }
                });
            } else {
                res.render('login', { alert: 'Invalid username or password or user is not active!', user: true });
            }
        });
    });
};


exports.dashboard = (req, res) => {
    res.render('dashboard');
}


exports.inventory = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const dashquery = `
            SELECT
                (SELECT COUNT(*) FROM books) AS total_books,
                (SELECT COUNT(*) FROM userlogin WHERE role="user") AS total_users,
                (SELECT COUNT(*) FROM rent WHERE status = "active") AS total_rented_books,
                (SELECT COUNT(*) FROM books WHERE status = "active") AS available_books_to_borrow,
                (SELECT COUNT(DISTINCT userloginId) FROM rent WHERE status = "active") AS renting_users,
                (SELECT COUNT(*) FROM books WHERE status = "archived") AS archived_books
        `;

        connection.query(dashquery, (err, data) => {
            connection.release();
            if (!err) {
                const totalBooks = data[0].total_books;
                const totalUsers = data[0].total_users;
                const totalRentedBooks = data[0].total_rented_books;
                const availableBooksToBorrow = data[0].available_books_to_borrow;
                const rentingUsers = data[0].renting_users;
                const archivedBooks = data[0].archived_books;

                res.render('inventory', {
                    totalBooks,
                    totalUsers,
                    totalRentedBooks,
                    availableBooksToBorrow,
                    rentingUsers,
                    archivedBooks
                });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};


exports.userDashboard = (req, res) => {
    const userId = req.session.user.userloginId;

    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Query to get user's basic information
        const dashQuery = `
            SELECT
                first_name
            FROM
                userlogin
            WHERE
                userloginId = ?
        `;

        // Query to get a featured book (you can customize this query)
        const featuredBookQuery = `
            SELECT
                title AS featuredBook,
                main_author AS featuredBookAuthor,
                copies AS featuredBookCopies
            FROM
                books
            WHERE
                copies > 0
            ORDER BY RAND()
            LIMIT 1
        `;

        // Query to get the most recently added book
        const recentlyAddedBookQuery = `
            SELECT
                title AS recentlyAddedBook,
                main_author AS recentlyAddedBookAuthor,
                copies AS recentlyAddedBookCopies
            FROM
                books
            ORDER BY created_at DESC
            LIMIT 1
        `;

        // Query to get the all-time favorite book (most borrowed)
        const allTimeFavoriteQuery = `
            SELECT
                b.title AS favoriteBook,
                b.main_author AS favoriteBookAuthor,
                b.copies AS favoriteBookCopies
            FROM
                rent r
                JOIN books b ON r.bookId = b.bookId
            GROUP BY
                r.bookId
            ORDER BY
                COUNT(r.bookId) DESC
            LIMIT 1
        `;

        // Execute the queries
        connection.query(dashQuery, [userId], (err, userData) => {
            if (err) {
                connection.release();
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            connection.query(featuredBookQuery, (err, featuredBookData) => {
                if (err) {
                    connection.release();
                    console.log(err);
                    return res.status(500).send('Internal Server Error');
                }

                connection.query(recentlyAddedBookQuery, (err, recentlyAddedBookData) => {
                    if (err) {
                        connection.release();
                        console.log(err);
                        return res.status(500).send('Internal Server Error');
                    }

                    connection.query(allTimeFavoriteQuery, (err, allTimeFavoriteData) => {
                        connection.release();

                        if (err) {
                            console.log(err);
                            return res.status(500).send('Internal Server Error');
                        }

                        // Combine user data and additional data
                        const data = {
                            username: userData[0].first_name,
                            featuredBook: featuredBookData[0].featuredBook || 'No featured book available',
                            featuredBookAuthor: featuredBookData[0].featuredBookAuthor || 'Unknown',
                            featuredBookCopies: featuredBookData[0].featuredBookCopies || '0',
                            recentlyAddedBook: recentlyAddedBookData[0].recentlyAddedBook || 'No recently added book available',
                            recentlyAddedBookAuthor: recentlyAddedBookData[0].recentlyAddedBookAuthor || 'Unknown',
                            recentlyAddedBookCopies: recentlyAddedBookData[0].recentlyAddedBookCopies || '0',
                            favoriteBook: allTimeFavoriteData[0].favoriteBook || 'No favorite book available',
                            favoriteBookAuthor: allTimeFavoriteData[0].favoriteBookAuthor || 'Unknown',
                            favoriteBookCopies: allTimeFavoriteData[0].favoriteBookCopies || '0',
                        };

                        // Render the user-dashboard view with the combined data
                        res.render('user-dashboard', data);
                    });
                });
            });
        });
    });
};






exports.userViewRentedBooks = (req, res) => {
    const userId = req.session.user.userloginId;

    pool.getConnection((err, connection) => {
        if (err) {
            console.log('Error getting connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        const query = `
        SELECT rent.*, books.title, userlogin.userloginId, books.isbn, userlogin.username
        FROM rent
        JOIN books ON rent.bookId = books.bookId
        JOIN userlogin ON rent.userloginId = userlogin.userloginId
        WHERE rent.status = 'active' AND rent.userloginId = ?`;
        

        connection.query(query, [userId],(err, data) => {
            connection.release();

            if (err) {
                console.log('Error executing query:', err);
                return res.status(500).send('Internal Server Error');
            }

            console.log('Data:', data);

            res.render('user-view-rented', { data });
        });
    });
};



exports.viewuserreturned = (req, res) => {
    const userloginId = req.session.user.userloginId;

    pool.getConnection((err, connection) => {
        if (err) {
            console.log('Error getting connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        console.log('Connected as ID ' + connection.threadId);

        const query = `
            SELECT returntable.returnId, returntable.actual_return_date, returntable.status,
                   userlogin.first_name, userlogin.last_name, userlogin.contact,
                   books.isbn, books.title, rent.borrow_date
            FROM returntable
            LEFT JOIN userlogin ON returntable.userloginId = userlogin.userloginId
            LEFT JOIN books ON returntable.bookId = books.bookId
            LEFT JOIN rent ON returntable.borrowId = rent.borrowId
            WHERE returntable.userloginId = ?`; 

        connection.query(query, [userloginId], (err, data) => {
            connection.release();
            if (!err) {
                res.render('user-return-home', { data });
            } else {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }
        });
    });
};





exports.viewuser = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        const query = 'SELECT * FROM userlogin WHERE role = "user" AND status = "active"';

        connection.query(query, (err, data) => {
            connection.release();
            if (!err) {
                res.render('user-home', { data });
            } else {
                console.log(err);
            }
            console.log('The data is: \n', data);
        });
    });
};


exports.viewarchuser = (req,res) => {
    
    pool.getConnection((err, connection) => {
        if(err) throw err;
    
        console.log('Connected as ID' + connection.threadId);

        connection.query('SELECT * FROM userlogin WHERE status = "archived"', (err, data) => {
            connection.release();
            if(!err){
                res.render('user-archived', { data });
            }
            else{
                console.log(err);
            }
            console.log('The data is: \n', data);

        });
    });
}



exports.displaynewuser = (req,res) => {
    res.render('add-user');
}

exports.adduser = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).send('Internal Server Error');
        }

        const { first_name, last_name, username, contact, houseNum, street, municipality, city } = req.body;
        const defaultPassword = 'password123';
        const defaultRole = 'user';

        const isValidContact = /^63\d{10}$/.test(contact);

        if (!isValidContact) {
            connection.release();
            return res.status(400).send('Invalid contact number. Please enter a valid Philippine mobile number starting with "63" and containing 12 digits.');
        }

        bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
            if (err) {
                connection.release();
                throw err;
            }

            const insertQuery = `
                INSERT INTO userlogin 
                SET first_name = ?, 
                last_name = ?,
                username = ?,
                password = ?, 
                contact = ?,
                houseNum = ?,
                street = ?,               
                municipality = ?,
                city = ?,
                role = ?
            `;

            console.log('Connected as ID ' + connection.threadId);

            connection.query(insertQuery, [first_name, last_name, username, hashedPassword, contact, houseNum, street, municipality, city, defaultRole], (err, data) => {
                connection.release();

                if (!err) {
                    const isAlertSuccess = data && data.affectedRows > 0;

                    res.render('add-user', { alert: 'User added successfully!', isAlertSuccess });
                } else {
                    console.error('Error inserting user to the database:', err);
                    res.status(500).send('Internal Server Error');
                }

                console.log('The data is: \n', data);
            });
        });
    });
};



exports.resetPassword = (req, res) => {
    const userloginId = req.params.id; // Assuming you have a route parameter for user ID
    const defaultPassword = 'password123';

    // Hash the default password
    bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }

        const updateQuery = `
            UPDATE userlogin
            SET password = ?
            WHERE userloginId = ?
        `;

        // Update the user's password in the database
        pool.query(updateQuery, [hashedPassword, userloginId], (err, data) => {
            if (!err) {
                const isPasswordReset = data && data.affectedRows > 0;
                if (isPasswordReset) {
                    // Redirect to the edit account page or any other desired page
                    res.render('user-home', {alert: "Password reset succesfully", isAlertSuccess: true});
                } else {
                    res.status(500).send('Internal Server Error');
                }
            } else {
                res.render('user-home', {alert: "Error updating password", isAlertSuccess: false});
                console.log('Error updating password:', err);
                res.status(500).send('Internal Server Error');
            }
        });
    });
};

    


 exports.edituser = (req, res) => {

        pool.getConnection((err, connection) => {
            if(err) throw err;
    
            connection.query('SELECT * FROM userlogin WHERE userloginId = ?',[req.params.id], (err, data) => {
                connection.release();
                if(!err){
                    res.render('edit-user', { data });
                }
                else{
                    console.log(err);
                }
                console.log('The data is: \n', data);
    
            });
        });
    };

    exports.updateuser = (req, res) => {
        const update = `UPDATE userlogin 
            SET first_name = ?, 
            last_name = ?, 
            username = ?, 
            contact = ?,
            houseNum = ?,
            street = ?,
            municipality = ?,
            city = ?
            WHERE userloginId = ?`;
    
        pool.getConnection((err, connection) => {
            const { first_name, last_name, username, contact, houseNum, street, municipality, city } = req.body;
    
            connection.query(update, [first_name, last_name, username, contact, houseNum, street, municipality, city, req.params.id], (err, data) => {
    
                if (!err) {
    
                    connection.query('SELECT * FROM userlogin WHERE userloginId = ?', [req.params.id], (err, data) => {
                        
                        if (!err) {
                            res.render('edit-user', { data, alert: `${first_name} updated successfully`, isAlertSuccess: true });
                        } else {
                            console.log(err);
                        }
                        console.log('The data from user table: \n', data);
                    });
                } else {
                    console.log(err);
                }
                console.log('The data from user table: \n', data);
            });
        });
    };
    


exports.editAccount = (req, res) => {
    const userloginId = req.session.user.userloginId;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        const getUserDetailsQuery = 'SELECT * FROM userlogin WHERE userloginId = ?';

        connection.query(getUserDetailsQuery, [userloginId], (err, userData) => {
            connection.release();

            if (err) {
                console.error('Error fetching user details:', err);
                res.render('edit-account', { userData, alert: 'Error fetching user details', isAlertSuccess: false });
                return res.status(500).send('Internal Server Error');
            }

            if (userData.length === 0) {
                return res.status(404).send('User not found');
            }

            res.render('edit-account', { userData });
        });
    });
};



exports.viewSystemLogs = (req, res) => {
    const fetchLogsQuery = 'SELECT log_message FROM system_logs ORDER BY timestamp DESC';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        connection.query(fetchLogsQuery, (err, logs) => {
            connection.release();

            if (err) {
                console.error('Error fetching system logs:', err);
                return res.status(500).send('Internal Server Error');
            }

            res.render('system-logs', { logs });
        });
    });
};


exports.saveLogToDatabase = (logMessage) => {
    const insertLogQuery = 'INSERT INTO system_logs (log_message) VALUES (?)';

    pool.query(insertLogQuery, [logMessage], (err, result) => {
        if (err) {
            console.error('Error inserting log to database:', err);
        } else {
            console.log('Log inserted successfully:', result);
        }
    });
};




const validateUsername = (username) => {
    return username.length >= 3;
};

const validatePassword = (password) => {

    return password.length >= 6;
};

exports.updateAccount = (req, res) => {
    const { username, current_password, new_password, first_name, last_name, contact } = req.body;
    const userloginId = req.session.user.userloginId;

    if (!validateUsername(username)) {
        return res.render('edit-account', { alert: 'Invalid username format. Please enter a username with at least 2 characters.', isAlertSuccess: false });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting MySQL connection:', err);
            return res.status(500).send('Internal Server Error');
        }

        const getUserQuery = 'SELECT * FROM userlogin WHERE userloginId = ?';

        connection.query(getUserQuery, [userloginId], (err, userData) => {
            if (err) {
                connection.release();
                console.error('Error fetching user details:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (userData.length === 0) {
                connection.release();
                return res.status(404).send('User not found');
            }

            const user = userData[0];

            if (current_password) {
                bcrypt.compare(current_password, user.password, (compareErr, passwordMatch) => {
                    if (compareErr) {
                        connection.release();
                        console.error('Error comparing passwords:', compareErr);
                        return res.status(500).send('Internal Server Error');
                    }

                    if (!passwordMatch) {
                        connection.release();
                        return res.render('edit-account', { userData, alert: 'Current password is incorrect.', isAlertSuccess: false });
                    }

                    updateAccount(connection, username, new_password, first_name, last_name, contact, userloginId, res);
                });
            } else {
                updateAccount(connection, username, new_password, first_name, last_name, contact, userloginId, res);
            }
        });
    });
};

function updateAccount(connection, username, new_password, first_name, last_name, contact, userloginId, res) {
    const updateQuery = `
        UPDATE userlogin 
        SET username = ?, 
            ${new_password ? 'password = ?,' : ''} 
            first_name = ?, 
            last_name = ?, 
            contact = ?
        WHERE userloginId = ?
    `;

    const checkUsernameQuery = 'SELECT * FROM userlogin WHERE username = ? AND userloginId != ?';
    
    connection.query(checkUsernameQuery, [username, userloginId], (err, existingUser) => {
        if (err) {
            connection.release();
            console.error('Error checking existing username:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (existingUser.length > 0) {
            connection.release();
            return res.render('edit-account', { userData: existingUser[0], alert: 'Username already exists. Please choose a different username.', isAlertSuccess: false });
        }

        if (new_password) {
            bcrypt.hash(new_password, 10, (hashErr, hashedPassword) => {
                if (hashErr) {
                    connection.release();
                    console.error('Error hashing password during update:', hashErr);
                    return res.status(500).send('Internal Server Error');
                }

                executeUpdate(connection, hashedPassword, username, first_name, last_name, contact, userloginId, res);
            });
        } else {
            executeUpdate(connection, null, username, first_name, last_name, contact, userloginId, res);
        }
    });
}

function executeUpdate(connection, hashedPassword, username, first_name, last_name, contact, userloginId, res) {
    const params = [username];
    if (hashedPassword) {
        params.push(hashedPassword);
    }
    params.push(first_name, last_name, contact, userloginId);

    const updateQuery = `
        UPDATE userlogin 
        SET username = ?, 
            ${hashedPassword ? 'password = ?,' : ''} 
            first_name = ?, 
            last_name = ?, 
            contact = ?
        WHERE userloginId = ?
    `;

    connection.query(updateQuery, params, (err, result) => {
        connection.release();

        if (err) {
            console.error('Error updating user account:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (result.affectedRows > 0) {
            fetchUpdatedUserDetails(userloginId, res);
        } else {
            fetchCurrentUserDetails(userloginId, res, false);
        }
    });
}


function fetchUpdatedUserDetails(userloginId, res) {
    const getUserDetailsQuery = 'SELECT * FROM userlogin WHERE userloginId = ?';
    pool.query(getUserDetailsQuery, [userloginId], (err, userData) => {
        if (err) {
            console.error('Error fetching updated user details:', err);
            return res.status(500).send('Internal Server Error');
        }

        return res.render('edit-account', { userData, alert: 'Account updated successfully.', isAlertSuccess: true });
    });
}

function fetchCurrentUserDetails(userloginId, res, isAlertSuccess) {
    const getCurrentUserDetailsQuery = 'SELECT * FROM userlogin WHERE userloginId = ?';
    pool.query(getCurrentUserDetailsQuery, [userloginId], (err, userData) => {
        if (err) {
            console.error('Error fetching current user details:', err);
            return res.status(500).send('Internal Server Error');
        }

        return res.render('edit-account', { userData, alert: 'Account failed to update. Please check your input.', isAlertSuccess });
    });
}


exports.deleteuser = (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;

        // Check if the user has active rentals
        connection.query('SELECT * FROM rent WHERE userloginId = ? AND status = ?', [req.params.id, 'active'], (err, rentData) => {
            if (err) {
                connection.release();
                console.error('Error checking active rentals:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (rentData.length > 0) {
                connection.release();
                return res.render('user-home', { alert: 'Cannot archive user. They have active rentals.', isAlertSuccess: false });
            }

            // If the user doesn't have active rentals, proceed with archiving
            connection.query('UPDATE userlogin SET status = ? WHERE userloginId = ?', ['archived', req.params.id], (err, data) => {
                connection.release();
                if (!err) {
                    res.render('user-home', { alert: 'User archived successfully', isAlertSuccess: true });
                } else {
                    console.error(err);
                    res.status(500).send('Internal Server Error');
                }
                console.log('The data is: \n', data);
            });
        });
    });
};


exports.unarchiveUser = (req, res) => {
    pool.getConnection((err, connection) => {
      if (err) throw err;
  
      connection.query('UPDATE userlogin SET status = ? WHERE userloginId = ?', ['active', req.params.id], (err, data) => {
        connection.release();
        if (!err) {
          res.render('user-archived', {alert: "User restored successfully", isAlertSuccess: true});
        } else {
          console.log(err);
          res.status(500).send('Internal Server Error');
        }
      });
    });
  };
  

  exports.deleteUser = (req, res) => {
    pool.getConnection((err, connection) => {
      if (err) throw err;
  
      connection.query('DELETE FROM userlogin WHERE userloginId = ?', [req.params.id], (err, data) => {
        connection.release();
        if (!err) {
          res.redirect('/viewarchuser');
        } else {
          console.log(err);
          res.status(500).send('Internal Server Error');
        }
      });
    });
  };


  exports.showReports = (req, res) => {
    const reportType = req.body.reportType || 'Daily';

    pool.getConnection((err, connection) => {
        if (err) throw err;

        console.log('Connected as ID ' + connection.threadId);

        let dateCondition = '';
        switch (reportType) {
            case 'Daily':
                dateCondition = 'DATE(created_at) = CURDATE()';
                break;
            case 'Weekly':
                dateCondition = 'YEARWEEK(created_at) = YEARWEEK(CURDATE())';
                break;
            case 'Monthly':
                dateCondition = 'YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())';
                break;
            case 'Yearly':
                dateCondition = 'YEAR(created_at) = YEAR(CURDATE())';
                break;
            default:
                dateCondition = 'DATE(created_at) = CURDATE()';
        }

        const reportsQuery = `
            SELECT
                (SELECT COUNT(*) FROM rent WHERE ${dateCondition}) AS borrowed_books_count,
                (SELECT COUNT(*) FROM returntable WHERE ${dateCondition}) AS returned_books_count,
                (SELECT COUNT(*) FROM userlogin WHERE ${dateCondition}) AS user_registration_count,
                (SELECT COUNT(*) FROM userlogin WHERE ${dateCondition}) AS user_login_count,
                (SELECT COUNT(DISTINCT userloginId) FROM rent WHERE ${dateCondition}) AS user_borrow_count,
                (SELECT COUNT(DISTINCT userloginId) FROM returntable WHERE ${dateCondition}) AS user_return_count,
                (SELECT COUNT(*) FROM books WHERE ${dateCondition}) AS added_books_count,
                (SELECT COUNT(*) FROM books WHERE ${dateCondition} AND status = 'archived') AS archived_books_count,
                (SELECT COUNT(*) FROM books WHERE ${dateCondition} AND status = 'deleted') AS destroyed_books_count
        `;

        connection.query(reportsQuery, (err, data) => {
            connection.release();
            if (!err) {
                const borrowedBooksCount = data[0].borrowed_books_count;
                const returnedBooksCount = data[0].returned_books_count;
                const userRegistrationCount = data[0].user_registration_count;
                const userLoginCount = data[0].user_login_count;
                const userBorrowCount = data[0].user_borrow_count;
                const userReturnCount = data[0].user_return_count;
                const addedBooksCount = data[0].added_books_count;
                const archivedBooksCount = data[0].archived_books_count;
                const destroyedBooksCount = data[0].destroyed_books_count;
    
                res.render('reports', {
                    borrowedBooksCount,
                    returnedBooksCount,
                    userRegistrationCount,
                    userLoginCount,
                    userBorrowCount,
                    userReturnCount,
                    addedBooksCount,
                    archivedBooksCount,
                    destroyedBooksCount,
                    reportType  // Pass reportType to the frontend
                });
            } else {
                console.log(err);
                res.status(500).send('Internal Server Error');
            }
            console.log('The data is: \n', data);
        });
    });
};






exports.logout = (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                res.redirect('/');
            } else {
                res.redirect('/login');
            }
        });
    };