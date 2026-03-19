const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // TRUST THE TOKEN:
    // Instead of querying Supabase on every single request, we trust the decoded JWT payload.
    // This prevents transient DB errors from causing 401 logouts during navigation.
    
    // We attach the decoded info to req.user. 
    // If controllers need more fresh data, they can query it specifically.
    req.user = {
      id: decoded.id,
      role: decoded.role,
      school_id: decoded.school_id
    };
    
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
