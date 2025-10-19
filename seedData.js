import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user.model.js';
import Category from './models/category.model.js';
import Product from './models/product.model.js';
import Order from './models/order.model.js';
import Cart from './models/cart.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// Sample data
const users = [
  {
    name: 'Admin User',
    email: 'admin@prokrishi.com',
    phone: '+8801712345678',
    password: 'Admin@123',
    role: 'admin',
    isVerified: true,
    addresses: [
      {
        name: 'Office',
        phone: '+8801712345678',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Gulshan',
        postalCode: '1212',
        address: 'House 45, Road 12, Gulshan-1, Dhaka',
      },
    ],
  },
  {
    name: 'Karim Rahman',
    email: 'karim@example.com',
    phone: '+8801812345679',
    password: 'User@123',
    role: 'user',
    isVerified: true,
    addresses: [
      {
        name: 'Home',
        phone: '+8801812345679',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        postalCode: '1216',
        address: 'Block A, Road 5, Mirpur-10, Dhaka',
      },
    ],
  },
  {
    name: 'Fatima Akter',
    email: 'fatima@example.com',
    phone: '+8801912345680',
    password: 'User@123',
    role: 'user',
    isVerified: true,
    addresses: [
      {
        name: 'Home',
        phone: '+8801912345680',
        division: 'Chittagong',
        district: 'Chittagong',
        upazila: 'Panchlaish',
        postalCode: '4203',
        address: 'CDA Avenue, Panchlaish, Chittagong',
      },
    ],
  },
];

const categories = [
  {
    name: 'vegetables',
    slug: 'vegetables',
    description: 'Fresh organic vegetables from local farms',
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999',
  },
  {
    name: 'fruits',
    slug: 'fruits',
    description: 'Seasonal fresh fruits',
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b',
  },
  {
    name: 'rice',
    slug: 'rice',
    description: 'Premium quality rice varieties',
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
  },
  {
    name: 'pulses',
    slug: 'pulses',
    description: 'Various types of pulses and lentils',
    isFeatured: false,
    image: 'https://images.unsplash.com/photo-1585909695284-32d2985ac9c0',
  },
  {
    name: 'spices',
    slug: 'spices',
    description: 'Pure and aromatic spices',
    isFeatured: false,
    image: 'https://images.unsplash.com/photo-1596040033229-a0b3b4f5e2f5',
  },
  {
    name: 'dairy',
    slug: 'dairy',
    description: 'Fresh dairy products',
    isFeatured: true,
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da',
  },
  {
    name: 'fish',
    slug: 'fish',
    description: 'Fresh fish from rivers and farms',
    isFeatured: false,
    image: 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9',
  },
  {
    name: 'meat',
    slug: 'meat',
    description: 'Fresh halal meat',
    isFeatured: false,
    image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f',
  },
];

// Products will be created after categories
const productsData = [
  // Vegetables
  {
    name: 'Organic Tomato',
    categoryName: 'vegetables',
    price: 60,
    measurement: 1,
    unit: 'kg',
    stock: 500,
    isFeatured: true,
    sold: 145,
    status: 'active',
    description: 'Fresh organic tomatoes directly from local farms. Rich in vitamins and perfect for cooking.',
    image: 'https://images.unsplash.com/photo-1546470427-227c8a6ff9f7',
  },
  {
    name: 'Fresh Potato',
    categoryName: 'vegetables',
    price: 30,
    measurement: 1,
    unit: 'kg',
    stock: 1000,
    isFeatured: true,
    sold: 320,
    status: 'active',
    description: 'Premium quality potatoes suitable for all types of cooking.',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655',
  },
  {
    name: 'Green Chili',
    categoryName: 'vegetables',
    price: 80,
    measurement: 500,
    unit: 'g',
    stock: 200,
    isFeatured: false,
    sold: 89,
    status: 'active',
    description: 'Fresh green chilies with authentic spicy flavor.',
    image: 'https://images.unsplash.com/photo-1583874725840-a36ab8c2ef49',
  },
  {
    name: 'Onion',
    categoryName: 'vegetables',
    price: 40,
    measurement: 1,
    unit: 'kg',
    stock: 800,
    isFeatured: false,
    sold: 267,
    status: 'active',
    description: 'Fresh red onions, essential for every kitchen.',
    image: 'https://images.unsplash.com/photo-1508747703725-719777637510',
  },
  {
    name: 'Spinach',
    categoryName: 'vegetables',
    price: 40,
    measurement: 500,
    unit: 'g',
    stock: 150,
    isFeatured: false,
    sold: 54,
    status: 'active',
    description: 'Fresh green spinach rich in iron and vitamins.',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb',
  },

  // Fruits
  {
    name: 'Banana',
    categoryName: 'fruits',
    price: 50,
    measurement: 12,
    unit: 'pcs',
    stock: 300,
    isFeatured: true,
    sold: 178,
    status: 'active',
    description: 'Fresh ripe bananas (1 dozen). Rich in potassium and energy.',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e',
  },
  {
    name: 'Mango (Langra)',
    categoryName: 'fruits',
    price: 120,
    measurement: 1,
    unit: 'kg',
    stock: 200,
    isFeatured: true,
    sold: 156,
    status: 'active',
    description: 'Sweet and juicy Langra mangoes from Rajshahi.',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078',
  },
  {
    name: 'Apple (Fuji)',
    categoryName: 'fruits',
    price: 200,
    measurement: 1,
    unit: 'kg',
    stock: 150,
    isFeatured: false,
    sold: 67,
    status: 'active',
    description: 'Imported fresh Fuji apples. Crispy and sweet.',
    image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb',
  },
  {
    name: 'Orange',
    categoryName: 'fruits',
    price: 150,
    measurement: 1,
    unit: 'kg',
    stock: 180,
    isFeatured: false,
    sold: 92,
    status: 'active',
    description: 'Fresh juicy oranges loaded with Vitamin C.',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e',
  },

  // Rice
  {
    name: 'Miniket Rice',
    categoryName: 'rice',
    price: 65,
    measurement: 1,
    unit: 'kg',
    stock: 2000,
    isFeatured: true,
    sold: 489,
    status: 'active',
    description: 'Premium quality Miniket rice. Fine and aromatic.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c',
  },
  {
    name: 'Basmati Rice',
    categoryName: 'rice',
    price: 120,
    measurement: 1,
    unit: 'kg',
    stock: 500,
    isFeatured: true,
    sold: 234,
    status: 'active',
    description: 'Authentic Basmati rice with long grains and aromatic flavor.',
    image: 'https://images.unsplash.com/photo-1598318809752-5c4f7931190e',
  },
  {
    name: 'Brown Rice',
    categoryName: 'rice',
    price: 90,
    measurement: 1,
    unit: 'kg',
    stock: 300,
    isFeatured: false,
    sold: 78,
    status: 'active',
    description: 'Healthy brown rice rich in fiber and nutrients.',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5',
  },

  // Pulses
  {
    name: 'Red Lentil',
    categoryName: 'pulses',
    price: 110,
    measurement: 1,
    unit: 'kg',
    stock: 400,
    isFeatured: false,
    sold: 145,
    status: 'active',
    description: 'High quality red lentils (Masoor Dal) rich in protein.',
    image: 'https://images.unsplash.com/photo-1585909695284-32d2985ac9c0',
  },
  {
    name: 'Yellow Lentil',
    categoryName: 'pulses',
    price: 120,
    measurement: 1,
    unit: 'kg',
    stock: 350,
    isFeatured: false,
    sold: 98,
    status: 'active',
    description: 'Pure yellow lentils (Mug Dal) perfect for daily meals.',
    image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b',
  },

  // Spices
  {
    name: 'Turmeric Powder',
    categoryName: 'spices',
    price: 150,
    measurement: 250,
    unit: 'g',
    stock: 200,
    isFeatured: false,
    sold: 67,
    status: 'active',
    description: 'Pure turmeric powder with natural color and aroma.',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5',
  },
  {
    name: 'Chili Powder',
    categoryName: 'spices',
    price: 200,
    measurement: 250,
    unit: 'g',
    stock: 180,
    isFeatured: false,
    sold: 54,
    status: 'active',
    description: 'Pure red chili powder with authentic spicy flavor.',
    image: 'https://images.unsplash.com/photo-1599946347371-68eb71b16afc',
  },
  {
    name: 'Cumin Seeds',
    categoryName: 'spices',
    price: 180,
    measurement: 200,
    unit: 'g',
    stock: 150,
    isFeatured: false,
    sold: 43,
    status: 'active',
    description: 'Aromatic cumin seeds (Jeera) for authentic taste.',
    image: 'https://images.unsplash.com/photo-1596040033229-a0b3b4f5e2f5',
  },

  // Dairy
  {
    name: 'Fresh Milk',
    categoryName: 'dairy',
    price: 70,
    measurement: 1,
    unit: 'l',
    stock: 100,
    isFeatured: true,
    sold: 234,
    status: 'active',
    description: 'Fresh farm milk delivered daily. Pure and nutritious.',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
  },
  {
    name: 'Yogurt',
    categoryName: 'dairy',
    price: 60,
    measurement: 500,
    unit: 'g',
    stock: 150,
    isFeatured: false,
    sold: 123,
    status: 'active',
    description: 'Fresh homemade style yogurt. Creamy and delicious.',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777',
  },

  // Fish
  {
    name: 'Rui Fish',
    categoryName: 'fish',
    price: 350,
    measurement: 1,
    unit: 'kg',
    stock: 50,
    isFeatured: true,
    sold: 89,
    status: 'active',
    description: 'Fresh Rui fish from local ponds. Cleaned and ready to cook.',
    image: 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9',
  },
  {
    name: 'Hilsa Fish',
    categoryName: 'fish',
    price: 1200,
    measurement: 1,
    unit: 'kg',
    stock: 20,
    isFeatured: true,
    sold: 34,
    status: 'active',
    description: 'Premium Padma river Hilsa fish. The taste of Bangladesh.',
    image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6',
  },

  // Meat
  {
    name: 'Chicken (Broiler)',
    categoryName: 'meat',
    price: 180,
    measurement: 1,
    unit: 'kg',
    stock: 100,
    isFeatured: true,
    sold: 167,
    status: 'active',
    description: 'Fresh halal broiler chicken. Cleaned and ready to cook.',
    image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781',
  },
  {
    name: 'Beef',
    categoryName: 'meat',
    price: 650,
    measurement: 1,
    unit: 'kg',
    stock: 80,
    isFeatured: false,
    sold: 78,
    status: 'active',
    description: 'Fresh halal beef from local farms. Premium quality.',
    image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f',
  },
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB Atlas');

    // Clear existing data
    console.log('\nClearing existing data...');
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    console.log('✓ Cleared existing data');

    // Create users
    console.log('\nCreating users...');
    const createdUsers = await User.insertMany(users);
    console.log(`✓ Created ${createdUsers.length} users`);

    // Create categories
    console.log('\nCreating categories...');
    const createdCategories = await Category.insertMany(categories);
    console.log(`✓ Created ${createdCategories.length} categories`);

    // Create category map for easy lookup
    const categoryMap = {};
    createdCategories.forEach((cat) => {
      categoryMap[cat.name] = cat._id;
    });

    // Create products one by one to allow SKU generation
    console.log('\nCreating products...');
    const createdProducts = [];
    for (const productData of productsData) {
      const product = new Product({
        ...productData,
        category: categoryMap[productData.categoryName],
      });
      await product.save();
      createdProducts.push(product);
    }
    console.log(`✓ Created ${createdProducts.length} products`);

    // Create sample orders for regular users
    console.log('\nCreating sample orders...');
    const regularUsers = createdUsers.filter((u) => u.role === 'user');
    const orders = [];

    for (let i = 0; i < regularUsers.length; i++) {
      const user = regularUsers[i];
      const orderCount = Math.floor(Math.random() * 3) + 1; // 1-3 orders per user

      for (let j = 0; j < orderCount; j++) {
        const orderItemsCount = Math.floor(Math.random() * 3) + 1; // 1-3 items per order
        const selectedProducts = createdProducts
          .sort(() => 0.5 - Math.random())
          .slice(0, orderItemsCount);

        const orderItems = selectedProducts.map((product) => ({
          product: product._id,
          name: product.name,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: product.price,
        }));

        const totalPrice = orderItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const isPaid = status !== 'pending' && Math.random() > 0.3;

        orders.push({
          user: user._id,
          orderItems,
          shippingAddress: {
            address: user.addresses[0].address,
            district: user.addresses[0].district,
            upazila: user.addresses[0].upazila,
            postalCode: user.addresses[0].postalCode,
          },
          paymentMethod: isPaid ? 'Online Payment' : 'Cash on Delivery',
          totalPrice,
          totalAmount: totalPrice,
          status,
          paymentStatus: isPaid ? 'completed' : 'pending',
          isPaid,
          paidAt: isPaid ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
          isDelivered: status === 'delivered',
          deliveredAt: status === 'delivered' ? new Date() : null,
        });
      }
    }

    const createdOrders = await Order.insertMany(orders);
    console.log(`✓ Created ${createdOrders.length} sample orders`);

    // Create sample carts
    console.log('\nCreating sample carts...');
    const carts = regularUsers.slice(0, 2).map((user) => ({
      user: user._id,
      items: createdProducts
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 3) + 1)
        .map((product) => ({
          product: product._id,
          quantity: Math.floor(Math.random() * 3) + 1,
        })),
    }));

    const createdCarts = await Cart.insertMany(carts);
    console.log(`✓ Created ${createdCarts.length} sample carts`);

    // Display admin credentials
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE SEEDED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n🔐 ADMIN CREDENTIALS:');
    console.log('━'.repeat(60));
    console.log('Email:    admin@prokrishi.com');
    console.log('Password: Admin@123');
    console.log('Role:     admin');
    console.log('━'.repeat(60));
    console.log('\n👥 TEST USER CREDENTIALS:');
    console.log('━'.repeat(60));
    console.log('Email:    karim@example.com');
    console.log('Password: User@123');
    console.log('━'.repeat(60));
    console.log('Email:    fatima@example.com');
    console.log('Password: User@123');
    console.log('━'.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log('━'.repeat(60));
    console.log(`Users:      ${createdUsers.length}`);
    console.log(`Categories: ${createdCategories.length}`);
    console.log(`Products:   ${createdProducts.length}`);
    console.log(`Orders:     ${createdOrders.length}`);
    console.log(`Carts:      ${createdCarts.length}`);
    console.log('━'.repeat(60));
    console.log('\n✓ Database is ready to use!\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();

