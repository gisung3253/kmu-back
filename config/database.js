const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // SSL 설정 수정
    ssl: process.env.USE_SSL === 'true' ? {
        rejectUnauthorized: false  // SSL 인증서 검증 비활성화
    } : false
});

module.exports = pool;