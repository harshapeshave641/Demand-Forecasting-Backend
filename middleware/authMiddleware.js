const jwt = require('jsonwebtoken');
const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).json({ message: "Authorization failed: No token provided" });
    }

    const token = authHeader.split(' ')[1]; 
    
    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET is not set in environment variables");
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};



module.exports = authMiddleware;
