const jwt = require('jsonwebtoken')

module.exports = function generateToken(user){
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        process.env.JWT_SECRET || 'change_this_secret_in_env',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}