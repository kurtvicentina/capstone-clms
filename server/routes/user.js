const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const userController = require('../controllers/userController');

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        res.locals.isAuthenticated = true;
        res.locals.isLibrarian = req.session.user.role === 'librarian';
        res.locals.isUser = req.session.user.role === 'user';

        return next();
    } else {
        res.locals.isAuthenticated = false;
        res.redirect('/login');
    }
};


const logAction = (action) => {
    return (req, res, next) => {
        const timestamp = new Date();

        // Check if user is in session
        const username = req.session.user ? req.session.user.username : (req.body && req.body.username) || 'UnknownUser';

        const logMessage = `[${timestamp}] INFO: ${username} ${action}`;
        console.log(logMessage);

        userController.saveLogToDatabase(logMessage);
        next();
    };
};






router.get('/register', userController.displayRegistration);
router.post('/register', logAction('registered into the system'), userController.register);

router.get('/login', userController.displayLogin);
router.post('/login', logAction('logged in to the system'), userController.login);

router.get('/', isAuthenticated, (req, res) => {
    if (res.locals.isLibrarian) {
        userController.dashboard(req, res);
    } else if (res.locals.isUser) {
        userController.userDashboard(req, res);
    } else {
        res.status(403).send('Forbidden');
    }
});



router.get('/inventory', isAuthenticated, userController.inventory);
router.post('/', isAuthenticated, logAction('performed a librarian search'), bookController.search);
router.post('/filter', isAuthenticated, logAction('applied filters to book inventory'), bookController.filterBooks);
router.post('/userfilter', isAuthenticated, logAction('applied filters on their book list'), bookController.filterUserBooks);
router.post('/booklist', isAuthenticated, logAction('performed a librarian search'), bookController.booklistsearch);
router.get('/logout', isAuthenticated, logAction('has logout from the system'), userController.logout);
router.get('/reports', isAuthenticated, userController.showReports);
router.post('/reports', isAuthenticated, userController.showReports);
router.get('/system-logs', isAuthenticated, userController.viewSystemLogs);
router.get('/viewarchrent', isAuthenticated, bookController.viewarchrent);
router.get('/viewarchuser', isAuthenticated, userController.viewarchuser);
router.get('/bookcollection', isAuthenticated, bookController.bookCollections);
router.get('/avm', isAuthenticated, bookController.viewavm);
router.get('/periodicalsect', isAuthenticated, bookController.periodicalCollections);
router.get('/technical', isAuthenticated, bookController.technical);
router.get('/circulation-opt', isAuthenticated, bookController.circulation);
router.get('/viewarchbook', isAuthenticated, bookController.viewarchbook);
router.get('/borrow/:bookId', isAuthenticated, bookController.borrowBook);
router.post('/borrow/:bookId', isAuthenticated, logAction('borrowed a book'), bookController.borrowBook);
router.get('/viewbook', isAuthenticated, logAction('accessed the book list'),bookController.viewbook);
router.get('/viewuserbook', isAuthenticated, bookController.viewuserbook);
router.post('/sort-by-acquisition-date', bookController.sortByAcquisitionDate);
router.get('/circulation', isAuthenticated, bookController.viewcirculation);
router.get('/filipiniana', isAuthenticated, bookController.viewfilipiniana);
router.get('/fiction', isAuthenticated, bookController.viewfiction);
router.get('/reference', isAuthenticated, bookController.viewreference);
router.get('/generalities', isAuthenticated, bookController.viewgeneralities);
router.get('/philosophy', isAuthenticated, bookController.viewphilosophy);
router.get('/religion', isAuthenticated, bookController.viewreligion);
router.get('/socialscience', isAuthenticated, bookController.viewsocialci);
router.get('/languages', isAuthenticated, bookController.viewlanguages);
router.get('/naturalsci', isAuthenticated, bookController.viewnaturalsci);
router.get('/appliedsci', isAuthenticated, bookController.viewappliedsci);
router.get('/arts', isAuthenticated, bookController.viewarts);
router.get('/geoandhisto', isAuthenticated, bookController.viewgeoandhisto);
router.get('/journal', isAuthenticated, bookController.viewjournal);
router.get('/magazine', isAuthenticated, bookController.viewmagazine);
router.get('/newspaper', isAuthenticated, bookController.viewnews);
router.get('/viewuser', isAuthenticated, userController.viewuser);
router.get('/viewrent', isAuthenticated, bookController.viewrent);
router.get('/viewuserrent', isAuthenticated, userController.userViewRentedBooks);
router.get('/viewuserreturned', isAuthenticated, userController.viewuserreturned);
router.get('/return/:borrowId', isAuthenticated, logAction('returned a book'), bookController.returnBook);
router.get('/renew/:borrowId', isAuthenticated, logAction('renewed a book'), bookController.renewBook);
router.get('/viewreturned', isAuthenticated, bookController.viewreturned);
router.get('/addbook', isAuthenticated, bookController.displaynewbook);
router.get('/cataloging', isAuthenticated,bookController.cataloging);
router.get('/book-inventory', isAuthenticated,bookController.bookInventory);
router.get('/adduser', isAuthenticated, userController.displaynewuser);
router.get('/addrent', isAuthenticated, bookController.displaynewrent);
router.post('/addrent', isAuthenticated, logAction('borrowed a book'), bookController.addrent);
router.post('/addbook', isAuthenticated, logAction('added a book'), bookController.addbook);
router.post('/cataloging', isAuthenticated, logAction('added a book'), bookController.addbook);
router.post('/adduser', isAuthenticated, logAction('added a user'), userController.adduser);
router.get('/viewbook/:id', isAuthenticated, bookController.viewbookall);
router.get('/editbook/:id', isAuthenticated, bookController.editbook);
router.get('/edituser/:id', isAuthenticated, userController.edituser);
router.get('/editaccount/', isAuthenticated, userController.editAccount);
router.get('/notify-user/:id', isAuthenticated, logAction('notified a user'), bookController.notifyUser);
router.post('/editbook/:id', isAuthenticated, logAction('edited a book'), bookController.updatebook);
router.post('/edituser/:id', isAuthenticated, logAction('edited a user'), userController.updateuser);
router.post('/updateaccount/', isAuthenticated, logAction('updated their account'), userController.updateAccount);
router.get('/unarchivebook/:id', isAuthenticated, logAction('unarchived a book'), bookController.unarchiveBook);
router.get('/unarchiveuser/:id', isAuthenticated, logAction('unarchived a user'), userController.unarchiveUser);
router.get('/unarchiverent/:id', isAuthenticated, logAction('unarchived a rent'), bookController.unarchiveRent);
router.get('/deletebook/:id', isAuthenticated, logAction('deleted a book'),bookController.permaDeleteBook);
router.get('/archivebook/:id', isAuthenticated, logAction('archived a book'), bookController.deletebook);
router.get('/archiveuser/:id', isAuthenticated, logAction('archived a user'), userController.deleteuser);
router.get('/resetpassword/:id', isAuthenticated, logAction('archived a user'), userController.resetPassword);
router.get('/archiverent/:borrowId', isAuthenticated, logAction('archived a rent'), bookController.deleterent);
router.get('/deleteuser/:id', isAuthenticated, logAction('deleted a user'), userController.permaDeleteUser);



module.exports = router;