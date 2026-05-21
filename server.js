const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 配置CORS，限制来源（生产环境建议指定具体域名）
app.use(cors({
  origin: "*", // 生产环境改为具体域名，如：['https://yourdomain.com']
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* =========================  
   路径配置（使用绝对路径）
========================= */
const UPLOAD_DIR = path.resolve(__dirname, "uploads");

// 创建上传目录（带错误处理）
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true }); // recursive支持创建多级目录
    console.log(`上传目录已创建: ${UPLOAD_DIR}`);
  }
} catch (err) {
  console.error("创建上传目录失败:", err.message);
  process.exit(1); // 目录创建失败则退出进程
}

/* =========================
   静态资源
========================= */
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static("public"));

/* =========================
   Token验证中间件
========================= */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // 格式: Bearer <token>

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "未提供认证Token" 
    });
  }

  // 验证Token（生产环境建议使用jwt等加密方式）
  if (token !== "aeon-token") {
    return res.status(403).json({ 
      success: false, 
      message: "Token无效或已过期" 
    });
  }

  next();
};

/* =========================
   登录接口
========================= */
app.post("/login", (req, res) => {
  try {
    const { user, pass } = req.body;

    // 生产环境建议使用环境变量存储账号密码，且密码需加密存储
    const validUser = process.env.ADMIN_USER || "luoshanjinb";
    const validPass = process.env.ADMIN_PASS || "123456";

    if (user === validUser && pass === validPass) {
      return res.json({
        success: true,
        token: "aeon-token",
        message: "登录成功"
      });
    }

    res.status(401).json({
      success: false,
      message: "用户名或密码错误"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "登录接口异常: " + err.message
    });
  }
});

/* =========================
   上传配置（增加文件类型限制）
========================= */
// 允许的文件类型
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 替换文件名中的特殊字符，避免路径注入
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    const uniqueName = Date.now() + "-" + safeOriginalName;
    cb(null, uniqueName);
  }
});

// 文件过滤函数
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}，仅支持${ALLOWED_FILE_TYPES.join(", ")}`), false);
  }
};

// 配置multer，限制文件大小（10MB）
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/* =========================
   上传接口（需要Token验证）
========================= */
app.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "未选择上传文件"
        });
      }

      res.json({
        success: true,
        message: "文件上传成功",
        file: {
          name: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: "/uploads/" + req.file.filename
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "文件上传失败: " + err.message
      });
    }
  }
);

/* =========================
   文件列表接口（需要Token验证）
========================= */
app.get("/files", authenticateToken, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    
    const result = files.map(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      const stat = fs.statSync(filePath);
      
      // 排除目录，只返回文件
      if (stat.isFile()) {
        return {
          name: file,
          size: stat.size,
          url: "/uploads/" + file,
          createTime: stat.birthtime,
          modifyTime: stat.mtime
        };
      }
    }).filter(Boolean); // 过滤掉目录项

    // 按修改时间倒序排列
    res.json({
      success: true,
      files: result.sort((a, b) => b.modifyTime - a.modifyTime)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "获取文件列表失败: " + err.message
    });
  }
});

/* =========================
   删除文件接口（需要Token验证）
========================= */
app.delete("/delete/:name", authenticateToken, (req, res) => {
  try {
    // 安全处理文件名，防止路径遍历攻击
    const fileName = path.basename(req.params.name);
    const filePath = path.join(UPLOAD_DIR, fileName);

    // 检查文件是否存在且是文件（不是目录）
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      return res.json({
        success: true,
        message: `文件 ${fileName} 删除成功`
      });
    }

    res.status(404).json({
      success: false,
      message: `文件 ${fileName} 不存在`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "删除文件失败: " + err.message
    });
  }
});

/* =========================
   健康检查接口
========================= */
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "running",
    timestamp: new Date().toISOString(),
    uploadDir: UPLOAD_DIR
  });
});

/* =========================
   全局错误处理中间件
========================= */
app.use((err, req, res, next) => {
  console.error("全局错误:", err.stack);
  res.status(500).json({
    success: false,
    message: "服务器内部错误: " + err.message
  });
});

/* =========================
   启动服务
========================= */
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`上传目录: ${UPLOAD_DIR}`);
});

module.exports = app;