# LinkedIn Connection Assistant (Powered by Google Gemini 1.5 Flash)

A powerful Chrome extension that uses the Google Gemini 1.5 Flash API to automatically generate high-quality, personalized LinkedIn connection request messages. It analyzes target profiles and uses your professional context to craft messages that are contextually relevant and varied.

## 🚀 Features

- **Gemini 1.5 Flash Powered**: Leverages Google's latest, high-speed model to generate creative and professional connection messages.
- **Smart Profile Analysis**: Extracts key information from LinkedIn profiles including name, headline, company, location, and industry.
- **Deep Personalization**: Creates contextually relevant messages based on shared industry, experience, and interests.
- **Popup-Based Interface**: All functionality works from a clean, professional popup - no intrusive buttons on LinkedIn pages.
- **Easy Configuration**: Simple form to set your professional context and role.
- **Copy & Regenerate**: Generated messages can be copied to your clipboard or regenerated with a single click.
- **Privacy Focused**: Your professional context is stored locally. Profile data is only used for the API call and not stored.

## 📸 Screenshots

### Extension Popup Interface
The complete interface where you configure settings and generate messages:

![Popup Interface](https://via.placeholder.com/350x600/0073b1/ffffff?text=LinkedIn+Connection+Assistant+Popup)

### Message Generation
Generate personalized messages directly in the popup:

![Message Generation](https://via.placeholder.com/350x400/f8f9fa/333333?text=Generated+Message+Example)

## 🛠️ Installation & Setup

### 1. Manual Installation
1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the extension directory.
5.  The extension will appear in your Chrome toolbar.

### 2. Add Your API Key
1.  In the root of the extension folder, create a file named `.env`.
2.  Add your Google Gemini API key to this file in the following format:
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```
3.  You can get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).
4.  After adding the key, go back to `chrome://extensions/` and click the "Reload" button for the LinkedIn Connection Assistant.

**Security Note**: This method is for development purposes only. Do not share the extension files publicly, as your API key is bundled with them.

## 🎯 How to Use

### 1. Initial Setup
1.  Click the extension icon in your Chrome toolbar.
2.  Fill in your professional context:
    -   **Professional Context**: Describe your background, experience, and interests.
    -   **Industry/Role**: Your current role and industry.
3.  Click "Save Settings".

### 2. Generate Connection Messages
1.  Navigate to any LinkedIn profile page (e.g., `linkedin.com/in/username`).
2.  Click the extension icon to open the popup.
3.  Click "**Generate Message**". The extension will analyze the profile and call the Gemini API.
4.  Review the high-quality message that appears.
5.  Click "**Copy Message**" to copy it to your clipboard.
6.  Use the message when sending your connection request on LinkedIn.

## 🧠 How It Works

### Gemini-Powered Generation
The core of the extension is the `background.js` service worker, which constructs a detailed prompt and sends it to the Google Gemini API.

1.  **Data Collection**: The popup script gathers your professional context and the target's profile data (scraped by `content.js`).
2.  **Prompt Engineering**: A carefully crafted prompt is created, instructing the Gemini model to act as a LinkedIn networking expert and follow specific rules (e.g., character limits, tone).
3.  **API Call**: The background script makes a secure request to the Gemini API with the prompt.
4.  **Response Handling**: The generated message from the API is received and displayed in the popup.

### Project Structure
```
linkedin-connection-assistant/
├── .env                   # (You create this) Stores your API key
├── manifest.json          # Extension manifest with API permissions
├── popup.html             # Popup interface  
├── popup.js               # Handles UI and communication with background
├── content.js             # LinkedIn profile data extraction
├── background.js          # Service worker with Gemini API logic
└── styles.css             # All styling
```

## 🛡️ Privacy & Security

-   **API Key**: Your API key is stored locally in the `.env` file and is only used to communicate with the Google Gemini API.
-   **Local Processing**: Profile analysis happens locally. Data is only sent to Google's API for message generation and is not stored elsewhere.
-   **Minimal Permissions**: Requires access to LinkedIn.com for profile analysis and Google's API for message generation.
-   **Open Source**: Code is available for your review.

## 🚧 Browser Compatibility

- **Chrome**: Fully supported (Version 88+)
- **Edge**: Supported with Chromium-based Edge
- **Firefox**: Not currently supported (different extension API)
- **Safari**: Not currently supported

## 📝 Development

### Project Structure
```
linkedin-connection-assistant/
├── manifest.json          # Extension manifest
├── popup.html             # Settings popup interface  
├── popup.js               # Popup functionality with message generation
├── content.js             # LinkedIn profile data extraction
├── background.js          # Service worker
├── styles.css             # All styling
└── README.md              # Documentation
```

### Building for Production
1. Update version in `manifest.json`
2. Test on multiple LinkedIn profile types
3. Validate all selectors work with current LinkedIn layout
4. Package for Chrome Web Store submission

### Testing
- Test on various LinkedIn profiles (basic, premium, different layouts)
- Verify message generation works across different user contexts
- Test settings persistence across browser sessions
- Validate popup interface responsiveness

## 🐛 Troubleshooting

### "Connection failed. Please refresh the LinkedIn page."
-   **Cause**: This error appears if the LinkedIn page was already open before you installed or updated the extension. The content script, which reads the profile data, doesn't automatically load into existing tabs.
-   **Solution**: Simply **refresh the LinkedIn profile page**. This will allow Chrome to inject the necessary scripts, establishing the connection.

### Generate Button is Disabled
-   **Solution**: Ensure you have filled out both the "Your Professional Context" and "Your Industry/Role" fields in the popup. The button will only become active when you are on a valid LinkedIn profile page (`linkedin.com/in/...`).

## 📈 Future Enhancements

- **AI Integration**: Optional AI-powered message generation
- **A/B Testing**: Compare message effectiveness
- **Response Tracking**: Track connection acceptance rates
- **Team Features**: Share templates across teams
- **Multi-language Support**: Generate messages in different languages
- **Industry Templates**: Expanded template library

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Test thoroughly on multiple LinkedIn profiles
- Update documentation for new features
- Ensure backward compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for more personalized professional networking
- Built with modern web technologies and Chrome Extension APIs
- Thanks to the LinkedIn platform for providing rich professional data

## 📞 Support

For support, feature requests, or bug reports:
- Create an issue on GitHub
- Email: support@linkedin-connection-assistant.com
- Twitter: @LinkedInConnectAI

---

**Disclaimer**: This extension is not affiliated with or endorsed by LinkedIn. Use responsibly and in accordance with LinkedIn's terms of service. 