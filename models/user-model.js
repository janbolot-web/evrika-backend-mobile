import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true,  },
    name: { type: String,  },
    password: { type: String, },

    phoneNumber: {
      type: String,
      unique: true,
    },
    courses: [
      {
        name: { type: String },
        courseId: { type: String, default: "" },
        price: { type: String },
        isAccess: { type: Boolean, default: false },
        lessons: [
          {
            name: { type: String },
            videoUrl: { type: String },
            youtubeUrl: { type: String },
            description: { type: String },
          },
        ],
      },
    ],
    roles: [{ type: String, ref: "Role" }],
    avatarUrl: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", UserSchema);

// courses: [
//   {
//     courseId: { type: String },
//     modules: [
//       {
//         name: { type: String },
//         isAccess: { type: Boolean, default: false },
//         lessons: [
//           {
//             name: { type: String },
//             videoUrl: { type: String },
//             description: { type: String },
//           },
//         ],
//       },
//     ],
//   },
// ],
