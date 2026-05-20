const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   上传目录
========================= */

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

/* =========================
   静态资源
========================= */

app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* =========================
   登录接口
========================= */

app.post("/login", (req, res) => {

    const { user, pass } = req.body;

    if (
        user === "luoshanjinb"
        &&
        pass === "123456"
    ) {

        return res.json({
            success: true,
            token: "aeon-token"
        });

    }

    res.json({
        success: false
    });

});

/* =========================
   上传配置
========================= */

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, "uploads/");

    },

    filename: (req, file, cb) => {

        const uniqueName =
        Date.now() + "-" + file.originalname;

        cb(null, uniqueName);

    }

});

const upload = multer({
    storage
});

/* =========================
   上传接口
========================= */

app.post(
    "/upload",
    upload.single("file"),
    (req, res) => {

        res.json({
            success: true,
            file: {
                name: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                url: "/uploads/" + req.file.filename
            }
        });

    }
);

/* =========================
   文件列表接口
========================= */

app.get("/files", (req, res) => {

    const files =
    fs.readdirSync("uploads");

    const result = files.map(file => {

        const filePath =
        path.join("uploads", file);

        const stat =
        fs.statSync(filePath);

        return {
            name: file,
            size: stat.size,
            url: "/uploads/" + file
        };

    });

    res.json(result.reverse());

});

/* =========================
   删除文件接口
========================= */

app.delete("/delete/:name", (req, res) => {

    const filePath =
    path.join("uploads", req.params.name);

    if (fs.existsSync(filePath)) {

        fs.unlinkSync(filePath);

        return res.json({
            success: true
        });

    }

    res.json({
        success: false
    });

});

/* =========================
   启动服务
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {

    console.log("🚀 AEON FILE CENTER 已启动");

    console.log(
        `🌍 http://localhost:${PORT}`
    );

});