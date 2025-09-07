# Use Node.js LTS image
FROM node:22.13.0

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose port that your Express server listens on
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
