var express = require('express');
var bcrypt = require('bcryptjs');
var router = express.Router();
var op = require('./oracleDBOps');
var oracledb = require('oracledb');
var jwt = require('jsonwebtoken');
var async = require('async');


router.post('/', function (req, res) {
    loginUser(req, res);
});


module.exports = router;


function loginUser(req, res) {

    let userId = req.body.userId;
    let password = req.body.password;
    let userDB = {};

    var doConnect = function (cb) {
        op.doConnectCB(function (err, conn) {
            if (err) {
                cb(err, conn);
            }
            cb(null, conn);
        });
    };

    function doSelectUser(conn, cb) {
        let sqlStatement = `SELECT * FROM USERS_T WHERE USER_ID='${userId}'`;
        let bindVars = [];
        //  console.log(bindVars.join());
        conn.execute(sqlStatement
                , bindVars, {
                    outFormat: oracledb.OBJECT
                }, function (err, result)
        {
            if (err) {
                cb(err, conn);
            } else {
                if (result.rows.length === 0) {
                    cb({'err': 'User not found'}, conn);
                } else {
                    userDB = result.rows[0];
                    cb(null, conn);
                }
            }
        });
    }

    function doVerifyPassword(conn, cb) {
        bcrypt.compare(password, userDB.PASSWORD, function (err, isMatch) {
            if (err)
                cb(err, conn);
            if (!isMatch)
                cb({'err': 'Incorrect Password'}, conn);
            if (isMatch)
                cb(null, conn);
        });
    }

    function doSendUser(conn, cb) {
        let user = {};
        user.userId = userDB.USER_ID;
        user.name = userDB.NAME;
        user.email = userDB.EMAIL;
        user.phone = userDB.PHONE;
        user.role = userDB.ROLE;
        user.locId = userDB.LOC_ID;
        user.partGrp = userDB.PART_GRP;

        var token = 'JWT ' + jwt.sign({username: userDB.USER_ID}, 'somesecretforjswt', {expiresIn: 10080});
        user.token = token;
        
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(user)); 
    }


    async.waterfall(
            [doConnect,
                doSelectUser,
                doVerifyPassword,
                doSendUser
            ],
            function (err, conn) {
                if (err) {
                    console.error("In waterfall error cb: ==>", err, "<==");
                    res.status(500).json(err);
                }
                console.log("Done Waterfall");
                if (conn)
                    conn.close();
            });
}

