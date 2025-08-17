#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Start backend in background
echo "Starting backend server..."
cd "$SCRIPT_DIR/backend" && npm install && node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend from the main project directory
echo "Starting frontend development server..."
cd "$SCRIPT_DIR" && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Backend running on http://localhost:3001"
echo "Frontend running on http://localhost:5173"

# Function to clean up background processes
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C and call cleanup
trap cleanup INT

# Wait for user to stop
wait