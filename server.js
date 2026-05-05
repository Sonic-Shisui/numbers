const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Suffixes classiques jusqu'à 10^39
const SUFFIXES = {
    'k': 10n ** 3n,
    'm': 10n ** 6n,
    'b': 10n ** 9n,
    't': 10n ** 12n,
    'q': 10n ** 15n,
    'Q': 10n ** 18n,
    's': 10n ** 21n,
    'S': 10n ** 24n,
    'o': 10n ** 27n,
    'n': 10n ** 30n,
    'd': 10n ** 33n,
    'u': 10n ** 36n,
    'D': 10n ** 39n
};

// ------------------------------------------------------------
// Convertit une chaîne en chaîne décimale exacte (BigInt)
// Accepte : "2.5m", "1e300", "2.5e300"
// ------------------------------------------------------------
function parseAmountWithSuffix(input) {
    if (!input && input !== 0) return null;
    const str = String(input).toLowerCase().replace(/\s/g, '');

    // 1. Notation scientifique explicite (ex: "1e300", "2.5e300")
    const sciMatch = str.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
    if (sciMatch) {
        const base = sciMatch[1];
        const exp = BigInt(sciMatch[2]);
        try {
            if (base.includes('.')) {
                const parts = base.split('.');
                const integerPart = parts[0];
                const decimalPart = parts[1];
                const decimalLength = BigInt(decimalPart.length);
                const bigBase = BigInt(integerPart + decimalPart);
                // bigBase * 10^exp / 10^decimalLength
                const result = (bigBase * (10n ** exp)) / (10n ** decimalLength);
                return result.toString();
            } else {
                const bigBase = BigInt(base);
                return (bigBase * (10n ** exp)).toString();
            }
        } catch { return null; }
    }

    // 2. Suffixes classiques (k, m, b, ..., D)
    const suffixChars = Object.keys(SUFFIXES).join('');
    const regex = new RegExp(`^(\\d+(?:\\.\\d+)?)([${suffixChars}]?)$`, 'i');
    const match = str.match(regex);
    if (!match) return null;

    let valueStr = match[1];
    const suffix = match[2]?.toLowerCase();

    let bigValue;
    if (valueStr.includes('.')) {
        const parts = valueStr.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1];
        const decimalLength = BigInt(decimalPart.length);
        bigValue = BigInt(integerPart + decimalPart);
        const multiplier = SUFFIXES[suffix] || 1n;
        bigValue = (bigValue * multiplier) / (10n ** decimalLength);
    } else {
        bigValue = BigInt(valueStr) * (SUFFIXES[suffix] || 1n);
    }

    return bigValue.toString();
}

// ------------------------------------------------------------
// Formate un nombre (chaîne) avec le suffixe le plus approprié,
// ou en notation scientifique pour les très grands nombres
// ------------------------------------------------------------
function formatNumberWithSuffix(num) {
    if (num === null || num === undefined || num === '') return "0";
    try {
        const bigNum = BigInt(num);
        if (bigNum === 0n) return "0";

        const absNum = bigNum < 0n ? -bigNum : bigNum;
        const sign = bigNum < 0n ? "-" : "";

        // Chercher le plus grand suffixe <= absNum
        const sorted = Object.entries(SUFFIXES).sort((a, b) => {
            if (b[1] > a[1]) return 1;
            if (b[1] < a[1]) return -1;
            return 0;
        });

        let bestSuffix = null;
        let bestValue = null;
        for (const [suffix, value] of sorted) {
            if (absNum >= value) {
                bestSuffix = suffix;
                bestValue = value;
                break;
            }
        }

        if (bestSuffix) {
            const quotient = absNum / bestValue;
            const remainder = absNum % bestValue;
            const decimal = (remainder * 10n) / bestValue;
            let formatted = quotient.toString();
            if (decimal > 0n) {
                formatted += '.' + decimal.toString();
            }
            return sign + formatted + bestSuffix;
        }

        // Si aucun suffixe ne convient, utiliser la notation scientifique
        const str = absNum.toString();
        if (str.length <= 6) return sign + str; // nombre pas trop grand
        const exp = str.length - 1;
        const mantissa = str[0] + '.' + str.slice(1, 3); // 2 décimales
        return sign + mantissa + 'e' + exp;
    } catch (e) {
        return num.toString();
    }
}

// ------------------------------------------------------------
// Endpoints
// ------------------------------------------------------------
app.get("/api/parse", (req, res) => {
    const { input } = req.query;
    if (!input) {
        return res.status(400).json({ success: false, error: "Parameter 'input' required" });
    }
    const result = parseAmountWithSuffix(input);
    if (result === null) {
        return res.status(400).json({ success: false, error: "Invalid format. Examples: 1k, 2.5m, 10b, 1e300" });
    }
    const numResult = Number(result);
    if (numResult <= Number.MAX_SAFE_INTEGER && numResult >= Number.MIN_SAFE_INTEGER) {
        return res.json({ success: true, input, result: numResult });
    } else {
        return res.json({ success: true, input, result: result }); // chaîne pour les grands nombres
    }
});

app.get("/api/format", (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).json({ success: false, error: "Parameter 'number' required" });
    }
    const formatted = formatNumberWithSuffix(number);
    res.json({ success: true, number: number, formatted });
});

app.get("/", (req, res) => {
    res.send(`
        <h1>Number Conversion API (BigInt + Scientific)</h1>
        <p>Endpoints:</p>
        <ul>
            <li>GET /api/parse?input=2.5m</li>
            <li>GET /api/parse?input=1e300</li>
            <li>GET /api/format?number=2500000</li>
        </ul>
        <p>Supported suffixes: ${Object.keys(SUFFIXES).join(', ')}</p>
        <p>Also supports scientific notation e.g. 1e300</p>
    `);
});

app.listen(process.env.PORT || 3001, () => {
    console.log(`BigInt + Scientific conversion API running on port ${process.env.PORT || 3001}`);
});