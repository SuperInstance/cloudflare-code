# ClaudeFlare Mobile PWA - Deployment Guide

## Prerequisites

- Node.js 18+ and npm 10+
- Domain name with SSL certificate
- Hosting account (Cloudflare Pages, Vercel, or Netlify)

## Build for Production

```bash
# Install dependencies
npm install

# Build the app
npm run build

# The output will be in the `out/` directory
```

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

1. **Install Wrangler CLI**

```bash
npm install -g wrangler
```

2. **Login to Cloudflare**

```bash
wrangler login
```

3. **Deploy**

```bash
npm run build
wrangler pages deploy out --project-name=claudeflare-mobile
```

4. **Configure Custom Domain**

```bash
wrangler pages deploy out \
  --project-name=claudeflare-mobile \
  --branch=main \
  --custom-domain=mobile.claudeflare.com
```

### Option 2: Vercel

1. **Install Vercel CLI**

```bash
npm install -g vercel
```

2. **Deploy**

```bash
npm run build
vercel --prod
```

3. **Set Environment Variables**

```bash
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY production
```

### Option 3: Netlify

1. **Install Netlify CLI**

```bash
npm install -g netlify-cli
```

2. **Deploy**

```bash
npm run build
netlify deploy --prod --dir=out
```

3. **Configure netlify.toml**

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "out"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    Service-Worker-Allowed = "/"
```

## Environment Variables

Create a `.env.production` file:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.claudeflare.com
NEXT_PUBLIC_WS_URL=wss://api.claudeflare.com

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key

# Environment
NEXT_PUBLIC_ENV=production
```

## Generate VAPID Keys for Push Notifications

```bash
npx web-push generate-vapid-keys
```

Add the public key to your environment variables and keep the private key secure on your server.

## Service Worker Configuration

The service worker is automatically generated and configured in:

- `public/sw.js` - Service worker code
- `next.config.js` - PWA configuration
- `public/manifest.json` - Web app manifest

## SSL/TLS Setup

PWA features require HTTPS. Options:

1. **Cloudflare SSL** (Free)
   - Automatic with Cloudflare Pages
   - Full SSL mode

2. **Let's Encrypt** (Free)
   ```bash
   certbot certonly --standalone -d mobile.claudeflare.com
   ```

3. **Paid SSL Certificate**
   - DigiCert, Comodo, etc.

## Performance Optimization

### Enable Compression

Add to your hosting configuration:

```nginx
# Nginx example
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;

# Brotli
brotli on;
brotli_types text/plain text/css application/json application/javascript;
```

### CDN Configuration

1. **Cloudflare CDN**
   - Enable Auto Minify
   - Enable Brotli compression
   - Cache static assets for 1 year

2. **Cache Headers**

```http
Cache-Control: public, max-age=31536000, immutable
```

### Image Optimization

Images are automatically optimized by Next.js. For custom images:

```bash
# Optimize images before adding
npm install -g imagemin-cli
imagemin public/images/* --out-dir=public/images/optimized
```

## Monitoring

### Cloudflare Web Analytics

Add to `app/layout.tsx`:

```tsx
<script
  defer
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "your_token"}'
/>
```

### Google Analytics (Optional)

```bash
npm install @next/third-parties
```

## Testing Before Deployment

```bash
# Run tests
npm test

# Check build
npm run build

# Test locally
npm run serve
```

## Post-Deployment Checklist

- [ ] Verify app loads correctly
- [ ] Test PWA installation on iOS and Android
- [ ] Test offline functionality
- [ ] Test push notifications
- [ ] Check Lighthouse score (aim for 90+)
- [ ] Verify all API endpoints work
- [ ] Test on multiple devices
- [ ] Check SSL certificate is valid
- [ ] Verify service worker is registered
- [ ] Test background sync

## Troubleshooting

### Service Worker Not Registering

Check browser console for errors. Common issues:

1. **HTTPS required**: Ensure site is served over HTTPS
2. **Scope issues**: Service worker must be at root level
3. **Cache headers**: Don't cache `sw.js`

### Push Notifications Not Working

1. **Check VAPID keys**: Ensure keys are correctly configured
2. **Permission denied**: User must grant notification permission
3. **Subscription failed**: Check server-side push endpoint

### Build Errors

```bash
# Clear cache and rebuild
rm -rf .next out node_modules
npm install
npm run build
```

## Updates and Maintenance

### Deploying Updates

```bash
# Make changes
git add .
git commit -m "Update mobile app"

# Deploy
npm run build
wrangler pages deploy out
```

### Service Worker Updates

The service worker automatically checks for updates every 24 hours. To force updates:

1. Bump version in `public/sw.js`
2. Deploy new version
3. Users will get update on next visit

## Rollback Procedure

If deployment fails:

```bash
# Cloudflare Pages
wrangler pages deployment list --project-name=claudeflare-mobile
wrangler pages deployment rollback [deployment-id]

# Vercel
vercel rollback

# Netlify
netlify rollback
```

## Support

For issues or questions:
- GitHub: https://github.com/claudeflare/claudeflare
- Documentation: https://docs.claudeflare.com
- Discord: https://discord.gg/claudeflare
