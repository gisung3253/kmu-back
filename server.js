const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 루트 경로 추가
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'KMU Timetable API Server is running',
        secure: req.secure,
        protocol: req.protocol,
        host: req.get('host')
    });
});

// 라우터 설정
app.use('/api', require('./routes/timetableRoutes'));
app.use('/api', require('./routes/subjectAlternativeRoutes'));

// 서버 시작
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});