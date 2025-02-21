import express from 'express';
import joi from 'joi';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
const privateKey = "my-name";

// Schema for 

const schemaForSignup = joi.object({
    name: joi.string().required(),
    email: joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required(),
    userId: joi.string().required(),
    password: joi.string().min(5).required(),
    suspend: joi.number().required(),
    date:joi.number(),
    isDeleted: joi.boolean(),
    role: joi.string().valid('teacher', 'student').required(),
})

const schemaForLogin = joi.object({
    email: joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } }).required(),
    password: joi.string().min(5).required(),
});

const schemaForTeacherSub = joi.object({
    name: joi.string().required(),
    userId: joi.string().required(),
    subject: joi.string().required(),
    subcode:joi.string().required(),
})

const schemaForSuspend = joi.object({ 
    userId: joi.string().required(),
    day:joi.number().required(),
})

const schemaForMarks = joi.object({
    userId: joi.string().required(),
    mathematics: joi.number(),
    chemistry: joi.number(),
    hindi: joi.number(),
    physics: joi.number(),
    english: joi.number(),
    biology:joi.number(),
})

//middlewares

const validationSchema = (schema) => {
    return async (req, res, next) => {
        try {
            const result = await schema.validateAsync(req.body);
            console.log(result);
            if (!req.value) {
                req.value = {};
            }
            req.value["body"] = result;
            next();
        } catch (error) {
            return res.status(400).json({ msg: `Not valid request ${error}` });
        }
    }
}

const verifyAuth = async (req, res, next) => {

    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ msg: "token is not given" });
    }

    try {
        const result = await jwt.verify(token, privateKey);
        req.user = result;
        next();
    } catch (error) {
        return res.status(401).json({ msg: error.massage });
    }
}

const roleCheck = (roles) => {
    return async(req, res, next) =>{
        if(!roles.includes(req.user.role)) {
           return res.status(403).json({ msg: `Not allow ` });
        }
       next();
    }
}

//function for reused in various api

const readFile = (file, defaultData = []) => {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').trim() === '') {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const userFindByEmail = (users, email) => {
    return users.some((it) => it.email === email);
}

const indexById = (users, userId) => {
    return users.findIndex((it) => it.userId === userId);
}

app.post('/signup', validationSchema(schemaForSignup), (req, res) => {
    const principal = [{
        name: "principal",
        email: "principal@gmail.com",
        userId: "SG21800",
        password: "12345",
        role: "principal"
    }];

    if (req.body.role === 'principal') {
        return res.status(400).json({ msg: "User can't be principal" });
    }

    const users = readFile("users.txt", principal);

    if (userFindByEmail(users, req.body.email)) {
        return res.status(400).json({ msg: "email all read exists" });
    }

    const index = indexById(users, req.body.userId);
    if (index !== -1) {
        return res.status(400).json({ msg: "userId already register" });
    }

    users.push(req.body);
    fs.writeFileSync("users.txt", JSON.stringify(users, null, 2));

    return res.status(200).json({ msg: "Successfully register" });
});

app.post("/login", validationSchema(schemaForLogin), (req, res) => {
    const users = readFile('users.txt');

    const user = users.find((it) => it.email === req.body.email && it.password === req.body.password);

    if (!user) {
        return res.status(401).json({ msg: "User not register" })
    }
    if (user.role !== 'principal' && user.isDeleted === true) {
        return res.status(401).json({ msg: "User is deleted registered" });
    }

    if (user.role !== 'principal') {
        if (user.date !== undefined && (Date.now() - user.date) / (1000 * 60 * 60 * 24) < user.suspend) {
            return res.status(401).json({ msg: `User is suspended for ${user.suspend} days` });
        }
    }

    const token = jwt.sign(user, privateKey);
    return res.status(200).json({ token });
});

app.put("/suspend", validationSchema(schemaForSuspend), verifyAuth, roleCheck(["principal"]), (req, res) => {
    const users = readFile("users.txt");

    const index = indexById(users, req.body.userId);
    if (index === -1) {
        return res.status(404).json({ msg: "UserId not found" });
    }

    const data = {
        suspend: req.body.day,
        date:Date.now(),
    };
   
    Object.assign(users[index], data);

    fs.writeFileSync("users.txt", JSON.stringify(users, null, 2));
    return res.status(201).json({ msg: "User suspended" });
})

app.post('/teacher/details', validationSchema(schemaForTeacherSub), verifyAuth, roleCheck(["principal"]),(req, res) => {
    const subDetails = readFile('subDetails.txt');
    const index = indexById(subDetails, req.body.userId);
    if (index !== -1) {
        return res.status(400).json({msg:"Teacher all ready have subject"})
    }
    subDetails.push(req.body);
    fs.writeFileSync('subDetails.txt', JSON.stringify(subDetails,null,2));
    return res.status(201).json({msg:"Teacher subject Registered"})
})

app.get('/teacher/details', verifyAuth, roleCheck(["student", "teacher", "principal"]), (req, res) => {
    const subDetails = readFile('subDetails.txt');
    return res.status(200).json({ msg: subDetails });
})

app.post('/marks/insert', verifyAuth, validationSchema(schemaForMarks), roleCheck(["teacher", "principal"]), (req, res) => {
    const marks = readFile('marks.txt');
    const subDetails = readFile("subDetails.txt");

    const index = indexById(marks, req.body.userId);
    console.log(index);

    if (req.user.role === "teacher") {
        const index1 = indexById(subDetails, req.user.userId);
        const keys = Object.keys(req.body);
        if (keys.length===2 &&keys.some((it)=>it===subDetails[index1].subject)) {
            if (index === -1)
                marks.push(req.body);
            else
                Object.assign(marks[index], req.body);
        }
        else {
            return res.status(403).json({ msg: "Teacher can't add marks added for another subject " })
        }
    } else {
        if (index === -1) {
            marks.push(req.body);
        } else {
            Object.assign(marks[index], req.body);
        }
    }

    fs.writeFileSync('marks.txt', JSON.stringify(marks, null, 2));
    return res.status(201).json({ msg: "Marks added" })
})

app.put('/marks/update', verifyAuth, validationSchema(schemaForMarks), roleCheck(["teacher", "principal"]), (req, res) => {
    const marks = readFile('marks.txt');
    const subDetails = readFile("subDetails.txt");

    const index = indexById(marks, req.body.userId);
    console.log(index);

    if (req.user.role === "teacher") {
        const index1 = indexById(subDetails, req.user.userId);
        const keys = Object.keys(req.body);
        if (keys.length === 2 && keys.some(subDetails[index1].subject)) {
            if (index === -1)
                marks.push(req.body);
            else
                Object.assign(marks[index], req.body);
        }
        else {
            return res.status(403).json({ msg: "Teacher can't add marks added for another subject " })
        }
    } else {
        if (index === -1) {
            marks.push(req.body);
        } else {
            Object.assign(marks[index], req.body);
        }
    }

    fs.writeFileSync('marks.txt', JSON.stringify(marks, null, 2));
    return res.status(201).json({ msg: "Marks updated" })
})

app.get('/marks/get', verifyAuth, roleCheck(["student", "principal", "teacher"]), (req, res) => {
    const marks = readFile("marks.txt");

    if (req.user.role === "teacher" || req.user.role === "principal") {
        return res.status(200).json({marks});
    }

    const index = indexById(marks, req.user.userId);
    return res.status(200).json(`${marks[index]}`);
})

app.use('/', (req, res) => {
    return res.status(404).json({ msg: "Page is not found" });
})

const port = 3000;

app.listen(port, () => {
    console.log(`Server running of http://localhost:${port}`);
});
