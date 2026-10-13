import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Item } from '../models/Item';
import { BorrowRequest } from '../models/BorrowRequest';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';
import { Wishlist } from '../models/Wishlist';
import { Report } from '../models/Report';
import { syncUserReputation } from '../utils/reputation';

const runSeed = async (): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    console.error('[Seed] Aborting: Never seed a production database.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('[Seed] Clearing existing development collections...');

    await Promise.all([
      User.deleteMany({}),
      Item.deleteMany({}),
      BorrowRequest.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Wishlist.deleteMany({}),
      Report.deleteMany({}),
    ]);

    const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

    console.log('[Seed] Creating sample campus users and admin...');
    const [admin, aarav, priya, rohan, meera] = await User.create([
      {
        name: 'Campus Admin',
        email: 'admin@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'admin',
        department: 'Student Affairs & Campus Operations',
        year: 'Postgraduate',
        phone: '+1 (555) 100-0001',
        bio: 'BorrowBox platform administrator ensuring safe and reliable peer-to-peer campus sharing.',
      },
      {
        name: 'Aarav Sharma',
        email: 'aarav@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        department: 'Computer Science & Engineering',
        year: '3rd Year',
        phone: '+1 (555) 201-3344',
        bio: 'Robotics club lead and systems enthusiast. Happy to lend electronics, microcontrollers, and CS textbooks!',
      },
      {
        name: 'Priya Nair',
        email: 'priya@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        department: 'Electrical & Electronics Engineering',
        year: '4th Year',
        phone: '+1 (555) 202-7788',
        bio: 'Embedded systems researcher. Always have lab tools, calculators, and reference books available.',
      },
      {
        name: 'Rohan Verma',
        email: 'rohan@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        department: 'Mechanical Engineering',
        year: '2nd Year',
        phone: '+1 (555) 203-9900',
        bio: 'Badminton player and CAD designer. Looking to borrow exam calculators and share sports gear.',
      },
      {
        name: 'Meera Patel',
        email: 'meera@campus.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        department: 'Architecture & Design',
        year: '3rd Year',
        phone: '+1 (555) 204-1122',
        bio: 'Studio art and architecture student. Sharing drafting kits, cameras, and studio supplies.',
      },
    ]);

    console.log('[Seed] Creating campus item listings...');
    const items = await Item.create([
      {
        title: 'Casio fx-991EX ClassWiz Scientific Calculator',
        description:
          'Non-programmable scientific calculator approved for all engineering midterm and final exams. High-resolution LCD display, matrix/vector solver, and solar+battery powered.',
        category: 'Calculators',
        condition: 'Like New',
        images: [
          'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Main Library Ground Floor Lobby',
        owner: priya._id,
        status: 'Available',
        maxBorrowDays: 7,
        depositNote: 'Please show college ID card at pickup.',
      },
      {
        title: 'Introduction to Algorithms (CLRS) — 4th Edition Hardcover',
        description:
          'Cormen, Leiserson, Rivest, and Stein 4th Edition hardcover textbook. Clean pages with no highlighting. Essential for CS301 Design & Analysis of Algorithms.',
        category: 'Books',
        condition: 'Good',
        images: [
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'CS Department Atrium (Block C)',
        owner: aarav._id,
        status: 'Available',
        maxBorrowDays: 21,
        depositNote: 'Keep away from food/drinks; return in same condition.',
      },
      {
        title: 'Arduino Uno R4 WiFi + Sensor Starter Kit',
        description:
          'Complete microcontroller kit with Arduino Uno R4 WiFi board, breadboard, ultrasonic sensor, servo motors, OLED screen, jumper wires, and USB-C cable in a organizer box.',
        category: 'Project Components',
        condition: 'Like New',
        images: [
          'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Innovation Maker Lab (Room 204)',
        owner: aarav._id,
        status: 'Borrowed',
        maxBorrowDays: 14,
        depositNote: 'Verify component checklist upon pickup and return.',
      },
      {
        title: 'Apple 96W USB-C Power Adapter & 2m MagSafe/USB-C Cable',
        description:
          'Original fast charger for MacBook Pro/Air and USB-C laptops. Ideal if you forgot your charger at your dorm or need juice for a hackathon.',
        category: 'Electronics',
        condition: 'Good',
        images: [
          'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Student Union Coffee Shop',
        owner: priya._id,
        status: 'Reserved',
        maxBorrowDays: 3,
      },
      {
        title: 'Yonex Astrox Badminton Racquets (Pair) + Feather Shuttles',
        description:
          'Two lightweight graphite Yonex badminton racquets with fresh grip tape and a tube of Aerosensa shuttlecocks for indoor court sessions.',
        category: 'Sports Equipment',
        condition: 'Good',
        images: [
          'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Indoor Sports Complex Entrance',
        owner: rohan._id,
        status: 'Available',
        maxBorrowDays: 5,
      },
      {
        title: 'Rotring Isograph Technical Drafting Set & A3 Cutting Mat',
        description:
          'Professional architectural drafting pen set (0.2mm, 0.35mm, 0.5mm), aluminum scale ruler, adjustable set square, and self-healing A3 cutting mat.',
        category: 'Art Supplies',
        condition: 'Like New',
        images: [
          'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Architecture Studio Building Lobby',
        owner: meera._id,
        status: 'Borrowed',
        maxBorrowDays: 10,
      },
      {
        title: 'Digital Multimeter (Fluke 115) with Test Leads',
        description:
          'True-RMS digital multimeter for AC/DC voltage, current, continuity, capacitance, and diode testing. Great for analog & digital circuit lab assignments.',
        category: 'Project Components',
        condition: 'New',
        images: [
          'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'EEE Lab Corridor (Block B)',
        owner: priya._id,
        status: 'Available',
        maxBorrowDays: 7,
      },
      {
        title: 'USB-C 8-in-1 HDMI Presentation Hub & Laser Clicker',
        description:
          'Includes 4K HDMI output, VGA adapter, Ethernet, SD card reader, and wireless presentation remote with green laser pointer for seminar defenses.',
        category: 'Accessories',
        condition: 'Like New',
        images: [
          'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=80',
        ],
        pickupLocation: 'Central Lecture Hall Foyer',
        owner: meera._id,
        status: 'Available',
        maxBorrowDays: 4,
      },
    ]);

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    console.log('[Seed] Creating sample transactions across lifecycle states...');
    // 1. Returned transaction (completed on time)
    const completedTx = await BorrowRequest.create({
      item: items[0]._id, // Casio Calculator
      borrower: rohan._id,
      owner: priya._id,
      message: 'Hi Priya! I have my Thermodynamics midterm tomorrow morning and need an approved calculator.',
      pickupDate: new Date(now.getTime() - 10 * dayMs),
      expectedReturnDate: new Date(now.getTime() - 7 * dayMs),
      status: 'Returned',
      ownerResponseNote: 'Sure thing! Meet me at the Main Library desk at 5 PM.',
      handoverCode: 'BB-4A19',
      acceptedAt: new Date(now.getTime() - 10 * dayMs),
      handoverConfirmedAt: new Date(now.getTime() - 10 * dayMs),
      returnedAt: new Date(now.getTime() - 8 * dayMs),
      wasReturnedOnTime: true,
      returnConditionNote: 'Returned in spotless condition. Thanks!',
      borrowerReviewed: true,
      ownerReviewed: true,
    });

    // 2. Currently Borrowed transaction (active, not overdue)
    const activeBorrowedTx = await BorrowRequest.create({
      item: items[2]._id, // Arduino Kit
      borrower: priya._id,
      owner: aarav._id,
      message: 'Need the Arduino R4 WiFi kit for our IoT smart-grid demo this week.',
      pickupDate: new Date(now.getTime() - 2 * dayMs),
      expectedReturnDate: new Date(now.getTime() + 5 * dayMs),
      status: 'Borrowed',
      ownerResponseNote: 'Happy to help! All sensors are in the top compartment.',
      handoverCode: 'BB-8C2D',
      acceptedAt: new Date(now.getTime() - 3 * dayMs),
      handoverConfirmedAt: new Date(now.getTime() - 2 * dayMs),
    });

    // 3. Overdue Borrowed transaction (expectedReturnDate in the past)
    const overdueBorrowedTx = await BorrowRequest.create({
      item: items[5]._id, // Rotring Drafting Set
      borrower: rohan._id,
      owner: meera._id,
      message: 'Borrowing the drafting set for my Engineering Graphics sheet submission.',
      pickupDate: new Date(now.getTime() - 8 * dayMs),
      expectedReturnDate: new Date(now.getTime() - 2 * dayMs),
      status: 'Borrowed',
      ownerResponseNote: 'Please cap the 0.2mm pen tightly after use.',
      handoverCode: 'BB-9F01',
      acceptedAt: new Date(now.getTime() - 8 * dayMs),
      handoverConfirmedAt: new Date(now.getTime() - 8 * dayMs),
    });

    // 4. Accepted / Reserved transaction (awaiting handover)
    const acceptedTx = await BorrowRequest.create({
      item: items[3]._id, // Apple 96W Charger
      borrower: meera._id,
      owner: priya._id,
      message: 'Left my MacBook charger at home before jury presentation today!',
      pickupDate: new Date(now.getTime()),
      expectedReturnDate: new Date(now.getTime() + 2 * dayMs),
      status: 'Accepted',
      ownerResponseNote: 'I am at the Student Union Coffee Shop right now.',
      handoverCode: 'BB-3E77',
      acceptedAt: new Date(now.getTime() - 3600 * 1000),
    });

    // 5. Pending request (awaiting owner decision)
    const pendingTx = await BorrowRequest.create({
      item: items[1]._id, // CLRS Algorithms Book
      borrower: rohan._id,
      owner: aarav._id,
      message: 'Hey Aarav, could I borrow CLRS for a week to prepare for the Dynamic Programming quiz?',
      pickupDate: new Date(now.getTime() + 1 * dayMs),
      expectedReturnDate: new Date(now.getTime() + 8 * dayMs),
      status: 'Pending',
    });

    console.log('[Seed] Creating sample reviews, wishlist, notifications, and report...');
    await Review.create([
      {
        transaction: completedTx._id,
        item: items[0]._id,
        reviewer: rohan._id,
        reviewee: priya._id,
        role: 'borrower_to_owner',
        rating: 5,
        comment: 'Priya was super punctual at the library and the calculator worked like a charm for my exam!',
      },
      {
        transaction: completedTx._id,
        item: items[0]._id,
        reviewer: priya._id,
        reviewee: rohan._id,
        role: 'owner_to_borrower',
        rating: 5,
        comment: 'Rohan took great care of the calculator and returned it a day early.',
      },
    ]);

    await Promise.all([
      syncUserReputation(priya._id),
      syncUserReputation(rohan._id),
      syncUserReputation(aarav._id),
      syncUserReputation(meera._id),
    ]);

    await Wishlist.create([
      { user: aarav._id, item: items[6]._id },
      { user: aarav._id, item: items[4]._id },
      { user: priya._id, item: items[1]._id },
    ]);

    await Notification.create([
      {
        recipient: aarav._id,
        sender: rohan._id,
        type: 'REQUEST_RECEIVED',
        title: 'New Borrow Request',
        message: `Rohan Verma requested to borrow "${items[1].title}".`,
        relatedItem: items[1]._id,
        relatedRequest: pendingTx._id,
        isRead: false,
      },
      {
        recipient: priya._id,
        sender: aarav._id,
        type: 'ITEM_HANDOVER',
        title: 'Handover Confirmed — Item Borrowed',
        message: `Handover confirmed for "${items[2].title}".`,
        relatedItem: items[2]._id,
        relatedRequest: activeBorrowedTx._id,
        isRead: false,
      },
      {
        recipient: meera._id,
        sender: priya._id,
        type: 'REQUEST_ACCEPTED',
        title: 'Borrow Request Accepted!',
        message: `Priya Nair accepted your request for "${items[3].title}". Handover code: ${acceptedTx.handoverCode}`,
        relatedItem: items[3]._id,
        relatedRequest: acceptedTx._id,
        isRead: false,
      },
    ]);

    await Report.create({
      reporter: meera._id,
      targetType: 'user',
      targetUser: rohan._id,
      targetItem: items[5]._id,
      reason: 'Late Return / No Show',
      description:
        'The drafting set was expected back two days ago for my studio review. Requesting a gentle reminder from campus admin.',
      status: 'Pending',
    });

    console.log('\n============================================================');
    console.log('BorrowBox Development Seed Completed Successfully!');
    console.log('============================================================');
    console.log('Demo Accounts (All passwords: Password123!):');
    console.log('  - Admin:   admin@campus.edu');
    console.log('  - Student: aarav@campus.edu (CS, 3rd Year)');
    console.log('  - Student: priya@campus.edu (EEE, 4th Year)');
    console.log('  - Student: rohan@campus.edu (Mech, 2nd Year)');
    console.log('  - Student: meera@campus.edu (Arch, 3rd Year)');
    console.log('============================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runSeed();
