# Use Node.js LTS image
FROM node:22.13.0

WORKDIR /app

# Copy only package.json and package-lock.json for caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the Vite app
RUN npm run build

# Install 'serve' to serve the production build
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the build folder
CMD ["serve", "-s", "dist", "-l", "3000"]
