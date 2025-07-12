# Use official Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files first to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nodemon globally if you're using it
RUN npm install -g nodemon

# Copy rest of the code
COPY . .

# Expose the port your backend runs on
EXPOSE 5000

# Set the command to run the dev server
CMD ["npm", "run", "dev"]
