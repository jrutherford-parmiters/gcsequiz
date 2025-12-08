module.exports = async (request, response) => {
    // CORS Handling (allows your HTML page to talk to this endpoint)
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    
    // --- 1. CONFIGURATION: Define the Single Working Model ---
    // Using the stable model that resolved the previous 404 errors.
    const WORKING_MODEL = 'gemini-2.5-flash'; 
    
    // Define the list of API Keys to cycle through
    // IMPORTANT: These names (GEMINI_API_KEY_1, etc.) must be set in Vercel's Environment Variables.
    const CREDENTIALS = [
        { key: process.env.GEMINI_API_KEY_1, model: WORKING_MODEL },
        { key: process.env.GEMINI_API_KEY_2, model: WORKING_MODEL },
        { key: process.env.GEMINI_API_KEY_3, model: WORKING_MODEL },
        { key: process.env.GEMINI_API_KEY_4, model: WORKING_MODEL },
        { key: process.env.GEMINI_API_KEY_5, model: WORKING_MODEL }
        // Add more GEMINI_API_KEY_N entries here if needed
    ].filter(cred => cred.key); // Only uses keys that are actually set

    if (CREDENTIALS.length === 0) {
        console.error('CRITICAL: No API Keys are set (GEMINI_API_KEY_1, _2, _3, etc.).');
        return response.status(500).json({ error: 'Server configuration error: No API Keys provided.' });
    }

    // Body Parsing (Ensures the request body is ready for the API call)
    let requestBody;
    try {
        requestBody = request.body;
        if (typeof requestBody === 'string') {
            requestBody = JSON.parse(requestBody);
        }
        if (!requestBody.contents) {
            throw new Error('Missing contents in request body');
        }
    } catch (error) {
        return response.status(400).json({ error: 'Invalid JSON in request body.' });
    }

    // --- 2. FAILOVER LOGIC: Loop through all keys until one succeeds ---
    for (const { key, model } of CREDENTIALS) {
        // Construct the URL using the current key and the proven model
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        
        console.log(`Attempting API call with key/model: ${model}`);

        try {
            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            // SUCCESS: If the response is OK (200-299), return the result and exit the function.
            if (apiResponse.ok) {
                const data = await apiResponse.json();
                console.log(`SUCCESS: Tip generated using key for model ${model}.`);
                return response.status(200).json(data);
            }

            // FAILURE (e.g., 429 Quota Exceeded, 403 Forbidden): Log the error and move to the next key.
            const errorData = await apiResponse.json();
            console.warn(`FAILOVER: Key failed (Status ${apiResponse.status}). Moving to next key...`);
            
        } catch (error) {
            // CATCH: Network error or other fetch issue, move to the next key.
            console.error(`NETWORK ERROR for current key:`, error.message);
        }
    }

    // --- 3. ALL KEYS FAILED ---
    // If the loop finishes without success, all keys have failed.
    return response.status(503).json({ 
        error: 'Service Unavailable',
        message: `All ${CREDENTIALS.length} supplied API keys failed to return a valid response.`
    });
};


