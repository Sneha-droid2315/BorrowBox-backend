import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';

const promoteAdmin = async (): Promise<void> => {
  const emailArg = process.argv[2]?.trim().toLowerCase();

  if (!emailArg) {
    console.error('Usage: npm run promote-admin -- <student-email>');
    process.exit(1);
  }

  try {
    await connectDB();
    const user = await User.findOne({ email: emailArg });

    if (!user) {
      console.error(`Error: No user found with email "${emailArg}".`);
      await mongoose.disconnect();
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();

    console.log(`Success: "${user.name}" (${user.email}) has been promoted to admin.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to promote user:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

promoteAdmin();
