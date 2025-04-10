const express = require('express');
const cors = require('cors');
const helmet = require('helmet');  // 추가
require('dotenv').config();

const app = express();

// 보안 헤더 설정
app.use(helmet());

// CORS 설정 업데이트
app.use(cors({
    origin: ['http://localhost:3000', 'https://kmutimetable.vercel.app/'],  // 프론트엔드 도메인 추가 필요
    credentials: true
}));

app.use(express.json());

// 루트 경로
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