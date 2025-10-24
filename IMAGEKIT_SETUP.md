# ImageKit Setup Guide

## Environment Variables Required

Add these environment variables to your `.env` file:

```bash
# ImageKit Configuration
# Get these values from your ImageKit dashboard: https://imagekit.io/dashboard

# Your ImageKit Public Key (starts with "public_")
IMAGEKIT_PUBLIC_KEY=your_public_key_here

# Your ImageKit Private Key (starts with "private_")
IMAGEKIT_PRIVATE_KEY=your_private_key_here

# Your ImageKit URL Endpoint (starts with "https://ik.imagekit.io/")
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

## How to Get ImageKit Credentials

1. **Sign up for ImageKit**: Go to [https://imagekit.io](https://imagekit.io) and create an account
2. **Get your credentials**: 
   - Go to your ImageKit dashboard
   - Navigate to "Developer Options" in the sidebar
   - Copy your Public Key, Private Key, and URL Endpoint
3. **Add to environment**: Add the credentials to your `.env` file

## Features Enabled with ImageKit

### Backend Features:
- ✅ **Product Image Upload**: Upload product images to ImageKit
- ✅ **Category Image Upload**: Upload category images to ImageKit  
- ✅ **Media Gallery**: Full media management system
- ✅ **Image Optimization**: Automatic image optimization and transformation
- ✅ **CDN Delivery**: Fast global image delivery

### Frontend Features:
- ✅ **Image Optimization**: Automatic image resizing and format optimization
- ✅ **Responsive Images**: Different sizes for different use cases
- ✅ **WebP Support**: Automatic WebP conversion for better performance
- ✅ **Lazy Loading**: Optimized image loading

## ImageKit vs Cloudinary

### Advantages of ImageKit:
- 🚀 **Better Performance**: Faster image delivery
- 💰 **Cost Effective**: More affordable pricing
- 🔧 **Better API**: More intuitive API
- 📱 **Mobile Optimized**: Better mobile performance
- 🌍 **Global CDN**: Better global coverage

### Migration Benefits:
- ✅ **No Breaking Changes**: Existing Cloudinary images still work
- ✅ **Gradual Migration**: Can migrate images over time
- ✅ **Better Performance**: New images will be faster
- ✅ **Cost Savings**: Lower costs for image storage and delivery

## Folder Structure in ImageKit

```
/prokrishi/
├── products/          # Product images
├── categories/        # Category images  
└── media/            # Media gallery files
```

## Image Transformations

The system automatically applies these transformations:

### Product Images:
- **Thumbnail**: 150x150px, 70% quality
- **Card**: 400x400px, 75% quality  
- **Detail**: 800x800px, 85% quality
- **Full**: 1200x1200px, 90% quality

### Category Images:
- **Standard**: 200x200px, 75% quality

### Media Gallery:
- **Grid View**: 300x300px, 75% quality
- **List View**: 100x100px, 70% quality

## Testing ImageKit Integration

1. **Check Backend Logs**: Look for "✅ ImageKit initialized successfully"
2. **Test Upload**: Try uploading a product or category image
3. **Check Media Gallery**: Access `/dashboard/media` to see the media gallery
4. **Verify Images**: Check that images load correctly on the frontend

## Troubleshooting

### Common Issues:

1. **"ImageKit not configured" error**:
   - Check that all three environment variables are set
   - Verify the credentials are correct
   - Restart the server after adding environment variables

2. **Upload fails**:
   - Check ImageKit dashboard for usage limits
   - Verify folder permissions
   - Check network connectivity

3. **Images not loading**:
   - Check URL endpoint is correct
   - Verify public key is correct
   - Check CORS settings in ImageKit dashboard

### Debug Mode:

Add this to your `.env` to enable debug logging:

```bash
DEBUG=imagekit:*
```

## Support

- **ImageKit Documentation**: [https://docs.imagekit.io](https://docs.imagekit.io)
- **ImageKit Dashboard**: [https://imagekit.io/dashboard](https://imagekit.io/dashboard)
- **Support**: Contact ImageKit support for account-related issues
