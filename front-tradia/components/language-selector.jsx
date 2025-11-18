"use client"

import { motion } from "framer-motion"

const languages = [
    { code: "spanish", name: "Spanish" },
    { code: "english", name: "English" },
    { code: "french", name: "French" },
    { code: "german", name: "German" },
    { code: "italian", name: "Italian" },
    { code: "portuguese", name: "Portuguese" },
    { code: "chinese", name: "Chinese" },
    { code: "japanese", name: "Japanese" },
    { code: "russian", name: "Russian" },
    { code: "arabic", name: "Arabic" },
];

export default function LanguageSelector({ language, setLanguage }) {
    return (
        <div>
            <label htmlFor="language" className="block text-lg font-medium text-blue-800 mb-2">
                Target Language
            </label>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                >
                    {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>
            </motion.div>
        </div>
    )
}
