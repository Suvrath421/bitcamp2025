// gemini.js

const GEMINI_API_KEY = 'AIzaSyDaiSGpre-A9FMYhQFky2DXQabFPw0Z3-g';

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Sends a prompt to Gemini API and returns the text response
 * @param {string} prompt - The user’s input message
 * @returns {Promise<string>} - Gemini's response text
 */
export async function chat(prompt) {
    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Extract response text
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || '[No response received]';
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return `[Error]: ${error.message}`;
    }
}
