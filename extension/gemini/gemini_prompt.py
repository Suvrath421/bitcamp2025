import os
from dotenv import load_dotenv
from google import genai

load_dotenv()


client = genai.Client(api_key=os.getenv("API_KEY_GEMINI"))

response = client.models.generate_content(
    model="gemini-2.0-flash", 
    contents= 
    f"""
    I have a website analysis result that includes:

    1. The URL: {url}
    2. The p-values (from z-tests) for system resource deltas before and after visiting the website (A negative p-value means that the website's statistics were lower than the mean and a positive means that they were higher):  
    [{p_cpu}, {p_mem}, {p_bsent}, {p_brecv}, {p_load}: cpu_delta, memory_delta, bytes_sent_delta, bytes_recv_delta, full_load_time]
    3. The output of a static code analyzer:  
    {static_code}

    Please help me determine whether or not the website is safe to visit

    Respond in 1-2 sentences
    """
)
print(response.text)