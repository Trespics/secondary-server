const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');   
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Port configuration
const PORT = process.env.PORT || 5000;

// Import Routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const superAdminRoutes = require('./src/routes/superAdminRoutes');
const cbcRoutes = require('./src/routes/cbcRoutes');
const libraryRoutes = require('./src/routes/libraryRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const { initCronJobs } = require('./src/services/cronService');


const app = express();   

// Security & Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Public Health Check
app.get('/health', (req, res) => {
    res.json({    
        status: 'ok', 
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/cbc', cbcRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/public', publicRoutes);


// Base Route
app.get('/', (req, res) => {
    res.send('CBC eLearning System API - Status: Operational');
});

// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal Server Error' 
            : err.message
    });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
🚀 CBC eLearning Backend Operational
📡 Port: ${PORT}
🌍 URL: http://localhost:${PORT}
        `);
        // Initialize scheduled tasks
        initCronJobs();
    });
}

module.exports = app;
