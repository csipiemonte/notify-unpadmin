module.exports = function(logger) {

    function checkRole(role,req, res, next) {
        if(!req.session.shib_user || req.session.shib_user.roles.includes(role)) return next();

        var err = {name: "SecurityError", message: "You don't have grants"};
        return next({type: "security_error", status: 401, message: err});
    }

    return {
        checkAdmin : (req,res,next) => checkRole('admin',req, res, next),
        checkOperation : (req,res,next) => checkRole('operation',req, res, next),
    }
}