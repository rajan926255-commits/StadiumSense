# Security Policy — StadiumSense

## API Key Security
- Gemini API key stored in sessionStorage only
- Never persisted to localStorage or cookies
- Never sent to any server except Google's API
- Cleared automatically when browser tab closes
- User can update key anytime via header icon

## Data Privacy
- No user data stored on any server
- All crowd data is simulated (no real PII)
- Voice input processed locally via Web Speech API
- No analytics or tracking implemented

## Content Security
- All external resources loaded via HTTPS only
- No eval() or innerHTML with user input
- Input sanitization on all user-provided fields

## Reporting Issues
Report security vulnerabilities to:
rajan926255@gmail.com