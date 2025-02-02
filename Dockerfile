# Use Node.js LTS (Long Term Support) image as the base
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Build the application (if needed)
RUN npm run build

# Expose the port the app runs on
EXPOSE 7531

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"] 