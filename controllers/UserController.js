import expressValidate from "express-validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import userModel from "../models/user-model.js";
import UserDto from "../dtos/user.dto.js";
import roleModel from "../models/role-model.js";
import twilio from "twilio";

// Метод для начала процесса верификации
let verificationCodes = {};

export const startVerification = async (req, res) => {
  try {
    // Извлекаем номер телефона из запроса
    const { phoneNumber } = req.body;
    // Инициализация Twilio клиента с использованием учетных данных из переменных окружения
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioClient = twilio(accountSid, authToken);

    // Генерация и сохранение случайного кода верификации для номера телефона
    const generateVerificationCode = () => {
      return Math.floor(100000 + Math.random() * 900000);
    };
    const verificationCode = generateVerificationCode();
    verificationCodes.phoneNumber = verificationCode;

    // Отправка SMS с сгенерированным кодом верификации
    await twilioClient.messages.create({
      body: `Ваш проверочный код: ${verificationCode}`,
      from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
      to: "whatsapp:" + phoneNumber,
    });
    // Ответ об успешной отправке кодаt
    res.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    // Обработка ошибок при отправке SMS
    console.error("Error sending SMS:", error);
    res.status(500).json({ success: false, message: "Error sending SMS" });
  }
};

// Метод для проверки введенного пользователем кода верификации
export const verifyCode = async (req, res) => {
  try {
    // Извлекаем номер телефона и введенный код из запроса
    const phoneNumber = req.body.phoneNumber;
    const userEnteredCode = req.body.code;
    // Проверка, существует ли уже пользователь с этим номером телефона
    const existingUser = await userModel.findOne({ phoneNumber: phoneNumber });

    // console.log("!!!!!!", verificationCodes.phoneNumber,phoneNumber,userEnteredCode);
    // Проверка соответствия введенного кода сохраненному коду верификации
    if (
      verificationCodes.phoneNumber.toString() === userEnteredCode.toString()
    ) {
      if (existingUser) {
        // Пользователь уже зарегистрирован, отправьте сообщение об этом
        const UserData = new UserDto(existingUser);
        return res.json({
          success: true,
          data: UserData,
          message: "Номер подтвержден!",
        });
      }
      const userRole = await roleModel.findOne({ value: "USER" });
      const newUser = new userModel({
        name: "",
        phoneNumber: phoneNumber,
        isDataUser: false,
        avatarUrl: "h",
        roles: [userRole.value],
        // Другие поля пользователя
      });

      const user = await newUser.save();
      // Создание экземпляра пользователя

      const token = jwt.sign(
        {
          _id: user._id,
          roles: user.roles,
        },
        "secret1234",
        { expiresIn: "30d" }
      );
      // Ответ об успешной верификации
      res.json({
        success: true,
        data: user,
        message: "Номер успешно подтвержден!",
      });
    } else {
      // Ответ о неудачной верификации
      res.status(401).json({ success: false, message: "Не правильный код" });
    }
  } catch (error) {
    // Обработка ошибок при проверке кода верификации
    console.error("Error verifying code:", error);
    res.status(500).json({ success: false, message: "Error verifying code" });
  }
};

export const setUserData = async (req, res) => {
  try {
    const name = req.body.name;
    console.log(name);
    const updateData = {
      $set: {
        name: name,
      },
    };
    const user = await userModel.findByIdAndUpdate(
      req.query.userId,
      updateData,
      { new: true }
    );
    console.log("Документ успешно обновлен:", user);
    res.json({ user, message: "Вы успешно авторизовались!" });
  } catch (error) {
    console.log(error);
  }
};

export const register = async (req, res) => {
  try {
    const errors = expressValidate.validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { email, password, name, avatarUrl } = req.body;
    const candidate = await userModel.findOne({ email });
    if (candidate) {
      return res
        .status(400)
        .json({ message: `Пользователь ${email} уже существует` });
    }
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const userRole = await roleModel.findOne({ value: "USER" });

    const doc = new userModel({
      email,
      password: hashPassword,
      name,
      avatarUrl: "f",
      roles: [userRole.value],
    });

    const user = await doc.save();

    const token = jwt.sign(
      {
        _id: user._id,
        roles: user.roles,
      },
      "secret1234",
      { expiresIn: "30d" }
    );

    const UserData = new UserDto(user);

    res.json({
      ...UserData,
      token,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Не удалось зарегистрироваться",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const isValidPass = await bcrypt.compare(password, user._doc.password);

    if (!isValidPass) {
      return res.status(400).json({ message: "Неверный логин или пароль" });
    }

    const token = jwt.sign(
      {
        _id: user._id,
        roles: user.roles,
      },
      "secret1234",
      { expiresIn: "30d" }
    );

    const UserData = new UserDto(user);

    res.json({
      data: { ...UserData, token },
      message: "Вы успешно авторизовались",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Не удалось авторизваться",
    });
  }
};

export const getMe = async (req, res) => {
  try {
    // console.log(req.userId);
    const user = await userModel.findById(req.userId).populate("courses");
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    const UserData = new UserDto(user);

    res.json(UserData);
  } catch (e) {
    console.log(e);
    res.status(500).json({
      message: "Нет доступа",
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await userModel.find();

    res.json(users.reverse());
  } catch (e) {
    console.log(e);
  }
};

// export const getUsersTest = async (req, res) => {
//   try {
//     const users = await userModel.find();
//     let userId = [];
//     users.map((user) =>
//       user.courses.map((course) => {
//         if (course == null) return;
//         course.lessons.map((lesson) => {
//           if (lesson.name == "Киришүү сабагы") {
//             userId.push(user.id);
//           }
//           return;
//         });
//       })
//     );
//     userId.map(async (user) => {
//       const userData = await userModel.findById(user);
//       let newData = [];
//       userData.courses.map((course, index) => {
//         let lessonsData = [];
//         course.lessons.map((lesson) => {
//           lessonsData.push({
//             name: lesson.name,
//             videoUrl: lesson.videoUrl,
//             description: lesson.description,
//             youtubeUrl:
//               lesson.name === "Киришүү сабагы"
//                 ? "https://youtu.be/qJ3cUsHClQA"
//                 : lesson.name === "Алгачкы окуучуларды окутуу боюнча..."
//                 ? "https://youtu.be/cayiHYUM32g"
//                 : lesson.name == "\"Самореализация \""
//                 ? "https://youtu.be/XQc_tTRcZaU"
//                 : lesson.name ===
//                   "Шар окуунун алгачкы сабагы жана алгачкы методикалары."
//                 ? "https://youtu.be/WyEpVLqOvss"
//                 : lesson.name === "Шар окуу китебинин мазмуну."
//                 ? "https://youtu.be/jS67AbOxgOo"
//                 : lesson.name ===
//                   " Шар окуу китебиндеги көнүгүүлөрдүн инструкциясы..."
//                 ? "https://youtu.be/kucjktQHeZY"
//                 : lesson.name === "Шар окуу методикалары."
//                 ? "https://youtu.be/erbAP7q4QSo"
//                 : lesson.name ===
//                   "Баланын окуудагы көйгөйлөрүн жоюуга арналган методикалар."
//                 ? "https://youtu.be/uvi8dlnPRQI"
//                 : lesson.name ===
//                   " Баланын окуу ылдамдыгын арттыруучу методикалар."
//                 ? "https://youtu.be/tzNhjOftLU8"
//                 : lesson.name === "Баланын түшүнүгүн арттырууга иштөө." ??
//                   "https://youtu.be/0Vft7qmPdzU",
//           });
//         });
//         newData.push({
//           name: course.name,
//           courseId: course.courseId,
//           price: course.price,
//           isAccess: course.isAccess,
//           lessons: lessonsData,
//         });
//       });
//       const updatedData = await userModel.findByIdAndUpdate(user, {
//         courses: newData,
//       });
//       res.json(updatedData);
//     });

//     res.json({ message: "ok" });
//   } catch (e) {
//     console.log(e);
//   }
// };

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id).populate("courses");

    res.json(user);
  } catch (e) {
    console.log(e);
  }
};

export const searchUser = async (req, res) => {
  try {
    const user = await userModel
      .find({
        $or: [
          { name: { $regex: req.params.key } },
          { email: { $regex: req.params.key } },
        ],
      })
      .populate("courses");

    res.json(user);
  } catch (e) {
    console.log(e);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await userModel.findByIdAndDelete({ _id: id });
    res.json({ message: "Пользователь успешно удален" });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Не удалось удалить пользователья" });
  }
};

// async function deleteUser(userId) {
//   try {
//     const result = await userModel.deleteOne({ _id: userId });

//     if (result.deletedCount === 1) {
//       console.log(`Пользователь с ID ${userId} успешно удален`);
//     } else {
//       console.log(`Пользователь с ID ${userId} не найден`);
//     }
//   } finally {
//     await client.close();
//   }
// }

// const roleModel = require("../models/role-model.js");
// const { validationResult } = require("express-validator");
// const userModel = require("../models/user-model.js");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const UserDto = require("../dtos/user.dto.js");

// const generateAccessToken = (id, roles) => {
//   const payload = {
//     id,
//     roles,
//   };

//   return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: "24h" });
// };

// class UserController {
//   async registration(req, res, next) {
//     try {
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res
//           .status(400)
//           .json({ message: "Ошибка при регистрации", errors: errors.array() });
//       }
//       const { email, password, name } = req.body;
//       const candidate = await userModel.findOne({ email });
//       if (candidate) {
//         return res
//           .status(400)
//           .json({ message: `Пользователь ${email} уже существует` });
//       }
//       const hashPassword = await bcrypt.hash(password, 3);
//       const userRole = await roleModel.findOne({ value: "USER" });
//       const user = new userModel({
//         email,
//         name,
//         password: hashPassword,
//         roles: [userRole.value],
//       });
//       const token = generateAccessToken(user._id, user.roles);
//       const userData = new UserDto(user,token);
//       await user.save();
//       return res.status(201).json(userData);
//     } catch (e) {
//       console.log(e);
//       res.status(400).json({ message: "Ошибка при регистрации" });
//     }
//   }
//   async login(req, res, next) {
//     try {
//       const { email, password } = req.body;
//       const user = await userModel.findOne({ email });

//       if (!user) {
//         return res
//           .status(400)
//           .json({ message: `Пользователь ${email} не найден` });
//       }
//       const validPassword = bcrypt.compareSync(password, user.password);
//       if (!validPassword) {
//         return res.status(400).json({ message: `Неверный пароль` });
//       }
//       const token = generateAccessToken(user._id, user.roles);
//       return res.json({ token });
//     } catch (e) {
//       console.log(e);
//       res.status(400).json({ message: "Login Error" });
//     }
//   }
//   async logout(req, res, next) {
//     try {
//     } catch (e) {
//       console.log(e);
//     }
//   }
//   async activate(req, res, next) {
//     try {
//     } catch (e) {
//       console.log(e);
//     }
//   }
//   async refresh(req, res, next) {
//     try {
//     } catch (e) {
//       console.log(e);
//     }
//   }
//   async getUsers(req, res, next) {
//     try {
//       const users = await userModel.find();

//       res.json(users);
//     } catch (e) {
//       console.log(e);
//     }
//   }
// }

// module.exports = new UserController();
