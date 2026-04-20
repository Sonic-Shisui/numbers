const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const SUFFIXES = {
    'k': 1e3,
    'm': 1e6,
    'b': 1e9,
    't': 1e12,
    'q': 1e15,
    'Q': 1e18,
    's': 1e21,
    'S': 1e24,
    'o': 1e27,
    'n': 1e30,
    'd': 1e33
};

function parseAmountWithSuffix(input) {
    if (!input && input !== 0) return null;
    const str = String(input).toLowerCase().replace(/\s/g, '');
    
    const scientificMatch = str.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
    if (scientificMatch) {
        return Math.floor(parseFloat(scientificMatch[1]) * Math.pow(10, parseInt(scientificMatch[2])));
    }
    
    const suffixChars = Object.keys(SUFFIXES).join('');
    const regex = new RegExp(`^(\\d+(?:\\.\\d+)?)([${suffixChars}]?)$`, 'i');
    const match = str.match(regex);
    if (!match) return null;
    
    let value = parseFloat(match[1]);
    const suffix = match[2]?.toLowerCase();
    
    if (isNaN(value)) return null;
    
    if (suffix && SUFFIXES[suffix]) {
        value *= SUFFIXES[suffix];
    }
    
    if (value > Number.MAX_SAFE_INTEGER) {
        console.warn(`Value ${value} exceeds MAX_SAFE_INTEGER`);
    }
    
    return Math.floor(value);
}

function formatNumberWithSuffix(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    
    const sorted = Object.entries(SUFFIXES).sort((a, b) => b[1] - a[1]);
    
    for (const [suffix, value] of sorted) {
        if (absNum >= value) {
            const formatted = (absNum / value).toFixed(1).replace(/\.0$/, '');
            return sign + formatted + suffix;
        }
    }
    return sign + absNum.toString();
}

app.get("/api/parse", (req, res) => {
    const { input } = req.query;
    if (!input) {
        return res.status(400).json({ success: false, error: "Parameter 'input' required" });
    }
    
    const result = parseAmountWithSuffix(input);
    if (result === null) {
        return res.status(400).json({ success: false, error: "Invalid format. Valid examples: 1k, 2.5m, 10b, 1e9" });
    }
    
    res.json({ success: true, input, result });
});

app.get("/api/format", (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ success: false, error: "Parameter 'number' required" });
    }
    
    const num = parseFloat(number);
    if (isNaN(num)) {
        return res.status(400).json({ success: false, error: "Invalid number" });
    }
    
    const formatted = formatNumberWithSuffix(num);
    res.json({ success: true, number: num, formatted });
});

app.post("/api/convert", (req, res) => {
    const { input, action } = req.body;
    
    if (action === "parse" || !action) {
        if (!input) {
            return res.status(400).json({ success: false, error: "Field 'input' required" });
        }
        const result = parseAmountWithSuffix(input);
        if (result === null) {
            return res.status(400).json({ success: false, error: "Invalid format" });
        }
        return res.json({ success: true, input, result });
    }
    
    if (action === "format") {
        const num = parseFloat(input);
        if (isNaN(num)) {
            return res.status(400).json({ success: false, error: "Invalid number" });
        }
        const formatted = formatNumberWithSuffix(num);
        return res.json({ success: true, number: num, formatted });
    }
    
    res.status(400).json({ success: false, error: "Invalid action. Use 'parse' or 'format'" });
});

app.get("/api/suffixes", (req, res) => {
    res.json({ success: true, suffixes: SUFFIXES });
});

app.get("/", (req, res) => {
    res.send(`
        <h1>Number Conversion API</h1>
        <p>Available endpoints:</p>
        <ul>
            <li><code>GET /api/parse?input=2.5m</code> → { "result": 2500000 }</li>
            <li><code>GET /api/format?number=2500000</code> → { "formatted": "2.5m" }</li>
            <li><code>POST /api/convert</code> with body { "input": "2.5m", "action": "parse" }</li>
            <li><code>GET /api/suffixes</code> → list of supported suffixes</li>
        </ul>
        <p>Supported suffixes: ${Object.keys(SUFFIXES).join(', ')}</p>
    `);
});

app.listen(PORT, () => {
    console.log(`Number conversion API running on port ${PORT}`);
});