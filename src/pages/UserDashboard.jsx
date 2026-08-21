import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getApiBaseUrl } from "../services/api";
import { updateMyProfile, uploadProfilePicture } from "../services/userService";
import { improveResumeSummary, improveResumeProject } from "../services/aiService";
import "./UserDashboard.css";
import ChatWidget from "../components/ChatWidget";
import jsPDF from "jspdf";

const API_ORIGIN = getApiBaseUrl().replace(/\/api\/?$/, "");

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

const emptyPersonalInfo = {
    name: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    github: "",
    linkedin: "",
    website: "",
};
const emptyEducation = { degree: "", institution: "", year: "", gpa: "" };
const emptyExperience = { role: "", company: "", location: "", duration: "", description: "" };
const emptyProject = { title: "", techStack: "", link: "", description: "" };

const POPULAR_SKILLS = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
    "Python", "Django", "Java", "C++", "MongoDB", "PostgreSQL",
    "SQL", "Docker", "Kubernetes", "AWS", "Git", "GraphQL",
    "Tailwind CSS", "Redux", "REST APIs", "CI/CD", "Agile", "Linux"
];

const COLOR_PALETTES = [
    { id: "indigo", name: "Indigo", primary: "#4338ca", accent: "#eef0ff", border: "#c7cbfa" },
    { id: "emerald", name: "Emerald", primary: "#059669", accent: "#ecfdf5", border: "#a7f3d0" },
    { id: "violet", name: "Violet", primary: "#7c3aed", accent: "#f5f3ff", border: "#ddd6fe" },
    { id: "cyan", name: "Ocean", primary: "#0891b2", accent: "#ecfeff", border: "#a5f3fc" },
    { id: "crimson", name: "Crimson", primary: "#dc2626", accent: "#fef2f2", border: "#fecaca" },
    { id: "slate", name: "Midnight", primary: "#1e293b", accent: "#f1f5f9", border: "#cbd5e1" },
];

function UserDashboard() {
    const navigate = useNavigate();
    const pictureInputRef = useRef(null);

    const [user, setUser] = useState(null);
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);

    // Active Navigation Tab: 'overview' | 'editor' | 'preview' | 'coach'
    const [activeTab, setActiveTab] = useState("overview");

    // Active Editor Accordion Section
    const [editorSection, setEditorSection] = useState("personal");

    // Profile modal
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [bio, setBio] = useState("");
    const [phone, setPhone] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Form data
    const [personalInfo, setPersonalInfo] = useState(emptyPersonalInfo);
    const [summary, setSummary] = useState("");
    const [skillsText, setSkillsText] = useState("");
    const [skillInput, setSkillInput] = useState("");
    const [certificationsText, setCertificationsText] = useState("");
    const [awardsText, setAwardsText] = useState("");
    const [education, setEducation] = useState([{ ...emptyEducation }]);
    const [experience, setExperience] = useState([{ ...emptyExperience }]);
    const [projects, setProjects] = useState([{ ...emptyProject }]);

    // AI field improvements
    const [aiImprovingSummary, setAiImprovingSummary] = useState(false);
    const [aiImprovingProjectIdx, setAiImprovingProjectIdx] = useState(null);

    // Resume Template & Palette
    const [selectedTemplate, setSelectedTemplate] = useState("modern");
    const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!token || !storedUser) {
            navigate("/login");
            return;
        }

        try {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
        } catch (e) {
            navigate("/login");
            return;
        }

        fetchResume();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(""), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const fetchResume = async () => {
        try {
            const response = await api.get("/resumes/me");
            if (response.data.success && response.data.resume) {
                const r = response.data.resume;
                setResume(r);
                prefillFormFromResume(r);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error("Failed to fetch resume:", error);
                setError("Failed to load resume information");
            }
        } finally {
            setLoading(false);
        }
    };

    const prefillFormFromResume = (r) => {
        if (!r) return;
        setPersonalInfo({
            ...emptyPersonalInfo,
            ...(r.personalInfo || {}),
        });
        setSummary(r.summary || "");
        setSkillsText((r.skills || []).join(", "));
        setCertificationsText((r.certifications || []).join(", "));
        setAwardsText((r.awards || []).join(", "));
        setEducation(r.education?.length ? r.education : [{ ...emptyEducation }]);
        setExperience(r.experience?.length ? r.experience : [{ ...emptyExperience }]);
        setProjects(r.projects?.length ? r.projects : [{ ...emptyProject }]);
    };

    const getSkillsList = () => {
        return skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    };

    const addSkillTag = (skillName) => {
        const currentList = getSkillsList();
        if (!currentList.includes(skillName)) {
            const updated = [...currentList, skillName];
            setSkillsText(updated.join(", "));
        }
    };

    const removeSkillTag = (skillToRemove) => {
        const currentList = getSkillsList();
        const updated = currentList.filter((s) => s !== skillToRemove);
        setSkillsText(updated.join(", "));
    };

    const handleCustomSkillAdd = (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (skillInput.trim()) {
                addSkillTag(skillInput.trim());
                setSkillInput("");
            }
        }
    };

    // Calculate ATS Resume Strength Score
    const calculateScore = () => {
        let score = 0;
        const details = [];

        // Personal Info
        if (personalInfo.name) score += 10;
        else details.push("Add your full name");

        if (personalInfo.email && personalInfo.phone) score += 10;
        else details.push("Add email and phone number");

        if (personalInfo.location || personalInfo.linkedin || personalInfo.github) score += 10;
        else details.push("Add location & social links");

        // Summary
        if (summary && summary.trim().length > 30) score += 15;
        else details.push("Write a strong professional summary");

        // Skills
        const skillsCount = getSkillsList().length;
        if (skillsCount >= 5) score += 15;
        else if (skillsCount > 0) score += 8;
        else details.push("Add at least 5 technical/soft skills");

        // Experience
        const validExp = experience.filter((e) => e.role && e.company);
        if (validExp.length >= 1) score += 20;
        else details.push("Add at least 1 work experience entry");

        // Education
        const validEdu = education.filter((e) => e.degree || e.institution);
        if (validEdu.length >= 1) score += 10;
        else details.push("Add your education background");

        // Projects
        const validProj = projects.filter((p) => p.title);
        if (validProj.length >= 1) score += 10;
        else details.push("Add a key project with details");

        return { score: Math.min(100, score), missing: details };
    };

    const scoreData = calculateScore();

    // Form array helpers
    const updateArrayRow = (setter, index, field, value) => {
        setter((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const addRow = (setter, template) => {
        setter((rows) => [...rows, { ...template }]);
    };

    const removeRow = (setter, index) => {
        setter((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
    };

    // AI Writing Polishers
    const handleImproveSummary = async () => {
        if (!summary.trim()) {
            setToast("Please write a summary draft first to enhance it with AI.");
            return;
        }
        setAiImprovingSummary(true);
        try {
            const data = await improveResumeSummary(summary);
            if (data.improvedSummary) {
                setSummary(data.improvedSummary);
                setToast("✨ Summary polished by Gemini AI!");
            }
        } catch (err) {
            console.error("AI Summary error:", err);
            setToast("AI Polish failed: " + (err.response?.data?.message || err.message));
        } finally {
            setAiImprovingSummary(false);
        }
    };

    const handleImproveProject = async (index) => {
        const proj = projects[index];
        if (!proj.title || !proj.description) {
            setToast("Please enter both project title and a description to improve.");
            return;
        }
        setAiImprovingProjectIdx(index);
        try {
            const data = await improveResumeProject(proj.title, proj.description);
            if (data.improvedDescription) {
                updateArrayRow(setProjects, index, "description", data.improvedDescription);
                setToast("✨ Project description enhanced with action verbs!");
            }
        } catch (err) {
            console.error("AI Project error:", err);
            setToast("AI Polish failed: " + (err.response?.data?.message || err.message));
        } finally {
            setAiImprovingProjectIdx(null);
        }
    };

    // Save/Submit Resume
    const handleSubmitResume = async () => {
        if (!personalInfo.name.trim()) {
            setError("Full name is required.");
            setToast("Please provide your full name.");
            setActiveTab("editor");
            setEditorSection("personal");
            return;
        }

        setSubmitting(true);
        setError("");

        const payload = {
            personalInfo,
            skills: getSkillsList(),
            certifications: certificationsText.split(",").map((s) => s.trim()).filter(Boolean),
            awards: awardsText.split(",").map((s) => s.trim()).filter(Boolean),
            education: education.filter((e) => e.degree || e.institution),
            experience: experience.filter((e) => e.role || e.company),
            projects: projects.filter((p) => p.title || p.description),
        };

        try {
            const response = await api.post("/resumes/submit", payload);
            if (response.data.success) {
                setResume(response.data.resume);
                if (response.data.resume?.summary) {
                    setSummary(response.data.resume.summary);
                }
                setToast("🎉 Resume saved & analyzed successfully!");
            }
        } catch (error) {
            console.error("Submit error:", error);
            setError(error.response?.data?.message || "Failed to save resume");
            setToast("Error saving resume");
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Resume
    const handleDeleteConfirmed = async () => {
        setShowConfirm(false);
        try {
            const response = await api.delete("/resumes/me");
            if (response.data.success) {
                setResume(null);
                setPersonalInfo({ ...emptyPersonalInfo });
                setSummary("");
                setSkillsText("");
                setCertificationsText("");
                setAwardsText("");
                setEducation([{ ...emptyEducation }]);
                setExperience([{ ...emptyExperience }]);
                setProjects([{ ...emptyProject }]);
                setToast("Resume deleted.");
                setActiveTab("overview");
            }
        } catch (error) {
            console.error("Delete error:", error);
            setError(error.response?.data?.message || "Failed to delete");
        }
    };

    // PDF Generator using jsPDF
    const downloadPdf = () => {
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 16;
        const contentWidth = pageWidth - margin * 2;
        let y = 18;

        const primaryHex = selectedPalette.primary;
        const r = parseInt(primaryHex.slice(1, 3), 16);
        const g = parseInt(primaryHex.slice(3, 5), 16);
        const b = parseInt(primaryHex.slice(5, 7), 16);

        // Header: Name & Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(20, 23, 31);
        doc.text(personalInfo.name || user?.name || "Your Name", margin, y);
        y += 7;

        if (personalInfo.title) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(r, g, b);
            doc.text(personalInfo.title, margin, y);
            y += 6;
        }

        // Contact info line
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(90, 95, 105);
        const contacts = [
            personalInfo.email || user?.email,
            personalInfo.phone || user?.phone,
            personalInfo.location,
            personalInfo.linkedin,
            personalInfo.github,
            personalInfo.website,
        ].filter(Boolean);

        const contactLine = contacts.join("  •  ");
        const splitContact = doc.splitTextToSize(contactLine, contentWidth);
        doc.text(splitContact, margin, y);
        y += splitContact.length * 4.5 + 4;

        // Accent Divider
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.8);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        const checkPageBreak = (neededHeight) => {
            if (y + neededHeight > 280) {
                doc.addPage();
                y = 16;
            }
        };

        const renderSectionHeading = (title) => {
            checkPageBreak(12);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(r, g, b);
            doc.text(title.toUpperCase(), margin, y);
            y += 2;
            doc.setDrawColor(220, 225, 235);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 5;
        };

        // Summary
        const activeSummary = summary || resume?.summary;
        if (activeSummary) {
            renderSectionHeading("Professional Summary");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(40, 44, 52);
            const sumLines = doc.splitTextToSize(activeSummary, contentWidth);
            checkPageBreak(sumLines.length * 4.5);
            doc.text(sumLines, margin, y);
            y += sumLines.length * 4.5 + 4;
        }

        // Experience
        const validExp = experience.filter((e) => e.role || e.company);
        if (validExp.length > 0) {
            renderSectionHeading("Work Experience");
            validExp.forEach((exp) => {
                checkPageBreak(16);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10.5);
                doc.setTextColor(20, 23, 31);
                doc.text(exp.role || "Role", margin, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9.5);
                doc.setTextColor(110, 115, 125);
                const durationText = exp.duration || "";
                const durWidth = doc.getTextWidth(durationText);
                doc.text(durationText, pageWidth - margin - durWidth, y);
                y += 4.5;

                doc.setFont("helvetica", "italic");
                doc.setTextColor(70, 75, 85);
                const companyLine = [exp.company, exp.location].filter(Boolean).join(" — ");
                doc.text(companyLine, margin, y);
                y += 4.5;

                if (exp.description) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(45, 50, 60);
                    const descLines = doc.splitTextToSize(exp.description, contentWidth);
                    checkPageBreak(descLines.length * 4);
                    doc.text(descLines, margin, y);
                    y += descLines.length * 4 + 3;
                }
                y += 2;
            });
        }

        // Projects
        const validProj = projects.filter((p) => p.title || p.description);
        if (validProj.length > 0) {
            renderSectionHeading("Key Projects");
            validProj.forEach((proj) => {
                checkPageBreak(14);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(20, 23, 31);
                doc.text(proj.title || "Project Title", margin, y);

                if (proj.techStack) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(9);
                    doc.setTextColor(r, g, b);
                    doc.text(` (${proj.techStack})`, margin + doc.getTextWidth(proj.title) + 2, y);
                }
                y += 4.5;

                if (proj.description) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(45, 50, 60);
                    const descLines = doc.splitTextToSize(proj.description, contentWidth);
                    checkPageBreak(descLines.length * 4);
                    doc.text(descLines, margin, y);
                    y += descLines.length * 4 + 3;
                }
                y += 2;
            });
        }

        // Education
        const validEdu = education.filter((e) => e.degree || e.institution);
        if (validEdu.length > 0) {
            renderSectionHeading("Education");
            validEdu.forEach((edu) => {
                checkPageBreak(12);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(20, 23, 31);
                doc.text(edu.degree || "Degree", margin, y);

                if (edu.year) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9.5);
                    doc.setTextColor(110, 115, 125);
                    const yearWidth = doc.getTextWidth(edu.year);
                    doc.text(edu.year, pageWidth - margin - yearWidth, y);
                }
                y += 4.5;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(70, 75, 85);
                const eduLine = [edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : null].filter(Boolean).join(" — ");
                doc.text(eduLine, margin, y);
                y += 6;
            });
        }

        // Skills
        const skillsList = getSkillsList();
        if (skillsList.length > 0) {
            renderSectionHeading("Skills & Expertise");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 35, 45);
            const skillsLine = skillsList.join("  •  ");
            const splitSkills = doc.splitTextToSize(skillsLine, contentWidth);
            checkPageBreak(splitSkills.length * 4.5);
            doc.text(splitSkills, margin, y);
            y += splitSkills.length * 4.5 + 4;
        }

        // Certifications & Awards
        const certList = certificationsText.split(",").map((c) => c.trim()).filter(Boolean);
        const awardList = awardsText.split(",").map((a) => a.trim()).filter(Boolean);

        if (certList.length > 0 || awardList.length > 0) {
            renderSectionHeading("Certifications & Honors");
            if (certList.length > 0) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(20, 23, 31);
                doc.text("Certifications: ", margin, y);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(50, 55, 65);
                const cText = doc.splitTextToSize(certList.join(", "), contentWidth - 25);
                doc.text(cText, margin + 25, y);
                y += cText.length * 4.5 + 2;
            }
            if (awardList.length > 0) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(20, 23, 31);
                doc.text("Awards: ", margin, y);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(50, 55, 65);
                const aText = doc.splitTextToSize(awardList.join(", "), contentWidth - 16);
                doc.text(aText, margin + 16, y);
                y += aText.length * 4.5 + 2;
            }
        }

        const cleanName = (personalInfo.name || user?.name || "My_Resume").replace(/\s+/g, "_");
        doc.save(`${cleanName}_Resume.pdf`);
        setToast("📥 PDF exported successfully!");
    };

    // Download as Word .doc
    const downloadAsWord = () => {
        const esc = (v) => (v || "").toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const activeSummary = summary || resume?.summary || "";

        const eduHtml = education
            .filter((e) => e.degree || e.institution)
            .map((e) => `<li><b>${esc(e.degree)}</b> — ${esc(e.institution)} ${e.year ? `(${esc(e.year)})` : ""}</li>`)
            .join("");

        const expHtml = experience
            .filter((e) => e.role || e.company)
            .map((e) => `<li><b>${esc(e.role)}</b> at ${esc(e.company)} ${e.duration ? `(${esc(e.duration)})` : ""}<br/>${esc(e.description)}</li>`)
            .join("");

        const projHtml = projects
            .filter((p) => p.title)
            .map((p) => `<li><b>${esc(p.title)}</b> ${p.techStack ? `<i>[${esc(p.techStack)}]</i>` : ""}<br/>${esc(p.description)}</li>`)
            .join("");

        const html = `
            <h2>${esc(personalInfo.name || user?.name)}</h2>
            ${personalInfo.title ? `<h4>${esc(personalInfo.title)}</h4>` : ""}
            <p>${esc(personalInfo.email || user?.email)} | ${esc(personalInfo.phone || user?.phone)} | ${esc(personalInfo.location)}</p>
            <p>${esc(personalInfo.github)} ${esc(personalInfo.linkedin)} ${esc(personalInfo.website)}</p>
            <hr/>
            ${activeSummary ? `<h3>Professional Summary</h3><p>${esc(activeSummary)}</p>` : ""}
            ${getSkillsList().length ? `<h3>Skills</h3><p>${esc(getSkillsList().join(", "))}</p>` : ""}
            ${expHtml ? `<h3>Work Experience</h3><ul>${expHtml}</ul>` : ""}
            ${projHtml ? `<h3>Projects</h3><ul>${projHtml}</ul>` : ""}
            ${eduHtml ? `<h3>Education</h3><ul>${eduHtml}</ul>` : ""}
            ${certificationsText ? `<h3>Certifications</h3><p>${esc(certificationsText)}</p>` : ""}
            ${awardsText ? `<h3>Awards & Honors</h3><p>${esc(awardsText)}</p>` : ""}
        `;

        const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body style="font-family: Calibri, sans-serif;">${html}</body></html>`;
        const blob = new Blob([fullHtml], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const cleanName = (personalInfo.name || user?.name || "resume").replace(/\s+/g, "_");
        a.download = `${cleanName}.doc`;
        a.click();
        URL.revokeObjectURL(url);
        setToast("📥 Word document downloaded!");
    };

    // Print Resume
    const handlePrint = () => {
        setActiveTab("preview");
        setTimeout(() => {
            window.print();
        }, 300);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const persistUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    const openEditProfile = () => {
        setBio(user?.bio || "");
        setPhone(user?.phone || "");
        setProfileError("");
        setShowEditProfile(true);
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        setProfileError("");
        try {
            const data = await updateMyProfile({ bio, phone });
            if (data.success) {
                persistUser(data.user);
                setToast("Profile updated successfully");
                setShowEditProfile(false);
            }
        } catch (error) {
            console.error("Update profile error:", error);
            setProfileError(error.response?.data?.message || "Failed to update profile");
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePictureInput = async (event) => {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file) return;

        setUploadingPicture(true);
        setProfileError("");
        try {
            const data = await uploadProfilePicture(file);
            if (data.success) {
                persistUser(data.user);
                setToast("Profile picture updated");
            }
        } catch (error) {
            console.error("Upload picture error:", error);
            setProfileError(error.response?.data?.message || "Failed to upload picture");
        } finally {
            setUploadingPicture(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-loading">
                    <span className="spinner-large"></span>
                    <p>Loading your AI Resume Studio...</p>
                </div>
            </div>
        );
    }

    const pictureUrl = user?.profilePicture ? `${API_ORIGIN}${user.profilePicture}` : null;
    const skillsList = getSkillsList();

    return (
        <div className="dashboard-page" style={{ "--brand-primary": selectedPalette.primary, "--brand-soft": selectedPalette.accent, "--brand-border": selectedPalette.border }}>
            {/* Ambient Background Accents */}
            <div className="ambient-glow glow-1"></div>
            <div className="ambient-glow glow-2"></div>

            {/* Sticky Studio Navigation */}
            <header className="studio-nav">
                <div className="studio-nav-container">
                    <div className="dashboard-brand" onClick={() => setActiveTab("overview")}>
                        <div className="brand-logo" style={{ background: selectedPalette.primary }}>
                            <span>R</span>
                            <div className="ai-badge">AI 2.0</div>
                        </div>
                        <div className="brand-text">
                            <h2>ResumeStudio</h2>
                            <p>AI Career Platform</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="nav-tabs">
                        <button
                            className={`nav-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                            onClick={() => setActiveTab("overview")}
                        >
                            <span className="tab-icon">📊</span>
                            <span>Overview</span>
                        </button>
                        <button
                            className={`nav-tab-btn ${activeTab === "editor" ? "active" : ""}`}
                            onClick={() => setActiveTab("editor")}
                        >
                            <span className="tab-icon">✍️</span>
                            <span>Resume Editor</span>
                            {scoreData.score < 80 && <span className="tab-badge">{scoreData.score}%</span>}
                        </button>
                        <button
                            className={`nav-tab-btn ${activeTab === "preview" ? "active" : ""}`}
                            onClick={() => setActiveTab("preview")}
                        >
                            <span className="tab-icon">🎨</span>
                            <span>Live Templates</span>
                        </button>
                        <button
                            className={`nav-tab-btn ${activeTab === "coach" ? "active" : ""}`}
                            onClick={() => setActiveTab("coach")}
                        >
                            <span className="tab-icon">💡</span>
                            <span>AI Career Coach</span>
                        </button>
                    </nav>

                    {/* Right User Actions */}
                    <div className="nav-actions">
                        <button className="preview-action-btn" onClick={() => setActiveTab(activeTab === "preview" ? "editor" : "preview")}>
                            {activeTab === "preview" ? "✏️ Edit Info" : "👁️ Live Preview"}
                        </button>

                        <div className="user-profile-chip" onClick={openEditProfile} title="Edit Profile">
                            <div className="profile-avatar-sm">
                                {pictureUrl ? (
                                    <img src={pictureUrl} alt={user?.name} />
                                ) : (
                                    user?.name?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <span className="chip-name">{user?.name?.split(" ")[0]}</span>
                        </div>

                        <button className="logout-btn" onClick={handleLogout} title="Logout">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="studio-main-content">
                {/* Global Error Banner */}
                {error && (
                    <div className="error-message">
                        <span>⚠</span>
                        <div style={{ flex: 1 }}>{error}</div>
                        <button className="error-close" onClick={() => setError("")}>✕</button>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 1: OVERVIEW & RESUME HUB                                  */}
                {/* ============================================================== */}
                {activeTab === "overview" && (
                    <div className="tab-content overview-tab animate-fade">
                        {/* Greeting Hero Banner */}
                        <div className="hero-greeting-card">
                            <div className="hero-text-side">
                                <div className="welcome-badge">🚀 AI Resume Workspace</div>
                                <h1>Welcome back, {user?.name || "Professional"}!</h1>
                                <p className="hero-subtitle">
                                    {resume
                                        ? "Your resume is analyzed and ready. You can polish sections with Gemini AI or export high-res PDFs."
                                        : "Let's build an ATS-optimized, recruiter-ready resume in minutes with Gemini AI."}
                                </p>

                                <div className="hero-quick-actions">
                                    <button className="btn-primary" onClick={() => setActiveTab("editor")}>
                                        ✍️ {resume ? "Update Resume Info" : "Build Resume Now"}
                                    </button>
                                    <button className="btn-secondary" onClick={() => setActiveTab("preview")}>
                                        🎨 Browse Templates & Export
                                    </button>
                                </div>
                            </div>

                            {/* ATS Score Meter Card */}
                            <div className="ats-score-meter-card">
                                <div className="score-meter-header">
                                    <span>ATS Strength Meter</span>
                                    <span className="score-badge-pill" style={{
                                        background: scoreData.score >= 80 ? "#ecfdf5" : scoreData.score >= 50 ? "#fffbeb" : "#fef2f2",
                                        color: scoreData.score >= 80 ? "#059669" : scoreData.score >= 50 ? "#d97706" : "#dc2626"
                                    }}>
                                        {scoreData.score >= 80 ? "🔥 Excellent" : scoreData.score >= 50 ? "⚡ Good Progress" : "⚠️ Incomplete"}
                                    </span>
                                </div>

                                <div className="score-radial-container">
                                    <div className="score-number-display">
                                        <span className="score-big">{scoreData.score}</span>
                                        <span className="score-denom">/100</span>
                                    </div>
                                    <div className="score-progress-bar-bg">
                                        <div
                                            className="score-progress-fill"
                                            style={{
                                                width: `${scoreData.score}%`,
                                                background: scoreData.score >= 80 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #6366f1, #4f46e5)"
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                {scoreData.missing.length > 0 ? (
                                    <div className="score-recommendations">
                                        <p className="rec-title">Next recommended steps:</p>
                                        <ul className="rec-list">
                                            {scoreData.missing.slice(0, 3).map((item, idx) => (
                                                <li key={idx} onClick={() => setActiveTab("editor")}>
                                                    <span className="rec-icon">👉</span> {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="score-all-set">🎉 Your resume profile has all core sections completed!</p>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="overview-stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>💼</div>
                                <div className="stat-info">
                                    <h3>{experience.filter((e) => e.role).length}</h3>
                                    <p>Work Experiences</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>⚡</div>
                                <div className="stat-info">
                                    <h3>{skillsList.length}</h3>
                                    <p>Skills Tagged</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>🚀</div>
                                <div className="stat-info">
                                    <h3>{projects.filter((p) => p.title).length}</h3>
                                    <p>Projects Listed</p>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>🎓</div>
                                <div className="stat-info">
                                    <h3>{education.filter((e) => e.degree || e.institution).length}</h3>
                                    <p>Education Entries</p>
                                </div>
                            </div>
                        </div>

                        {/* Gemini AI Recruiter Analysis Card */}
                        <div className="ai-summary-highlight-card">
                            <div className="ai-highlight-header">
                                <div className="ai-header-left">
                                    <div className="ai-spark-icon">✨</div>
                                    <div>
                                        <h2>Gemini AI Recruiter Summary</h2>
                                        <p>Auto-generated professional briefing derived from your profile</p>
                                    </div>
                                </div>
                                <div className="ai-header-actions">
                                    {resume?.summary && (
                                        <button
                                            className="btn-outline-sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(resume.summary);
                                                setToast("📋 AI Summary copied to clipboard!");
                                            }}
                                        >
                                            📋 Copy Summary
                                        </button>
                                    )}
                                    <button
                                        className="btn-outline-sm"
                                        onClick={() => {
                                            setActiveTab("editor");
                                            setEditorSection("summary");
                                        }}
                                    >
                                        ✏️ Edit
                                    </button>
                                </div>
                            </div>

                            <div className="ai-summary-body">
                                {resume?.summary ? (
                                    <p className="ai-summary-text">"{resume.summary}"</p>
                                ) : (
                                    <div className="ai-summary-placeholder">
                                        <p>You haven't generated your Gemini AI summary yet.</p>
                                        <button className="btn-primary-sm" onClick={() => setActiveTab("editor")}>
                                            Generate AI Summary Now
                                        </button>
                                    </div>
                                )}
                            </div>

                            {resume?.createdAt && (
                                <div className="ai-summary-footer">
                                    <span>Last analyzed & updated: {formatDate(resume.createdAt)}</span>
                                    <div className="footer-actions">
                                        <button className="link-action-btn" onClick={downloadPdf}>📄 Export PDF</button>
                                        <button className="link-action-btn" onClick={downloadAsWord}>📝 Download Word</button>
                                        <button className="link-danger-btn" onClick={() => setShowConfirm(true)}>🗑️ Delete Info</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 2: RESUME BUILDER / EDITOR                                */}
                {/* ============================================================== */}
                {activeTab === "editor" && (
                    <div className="tab-content editor-tab animate-fade">
                        <div className="editor-layout">
                            {/* Left Side Section Switcher */}
                            <aside className="editor-sidebar">
                                <div className="sidebar-header">
                                    <h3>Resume Sections</h3>
                                    <span className="sidebar-score">{scoreData.score}% Ready</span>
                                </div>

                                <div className="editor-nav-list">
                                    <button
                                        className={`editor-nav-item ${editorSection === "personal" ? "active" : ""}`}
                                        onClick={() => setEditorSection("personal")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">👤 Personal Details</span>
                                        {personalInfo.name && <span className="check-mark">✓</span>}
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "summary" ? "active" : ""}`}
                                        onClick={() => setEditorSection("summary")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">📝 Summary & AI Pitch</span>
                                        {summary && <span className="check-mark">✓</span>}
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "experience" ? "active" : ""}`}
                                        onClick={() => setEditorSection("experience")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">💼 Work Experience</span>
                                        <span className="count-pill">{experience.filter((e) => e.role).length}</span>
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "projects" ? "active" : ""}`}
                                        onClick={() => setEditorSection("projects")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">🚀 Key Projects</span>
                                        <span className="count-pill">{projects.filter((p) => p.title).length}</span>
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "education" ? "active" : ""}`}
                                        onClick={() => setEditorSection("education")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">🎓 Education</span>
                                        <span className="count-pill">{education.filter((e) => e.degree).length}</span>
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "skills" ? "active" : ""}`}
                                        onClick={() => setEditorSection("skills")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">⚡ Skills & Tech Stack</span>
                                        <span className="count-pill">{skillsList.length}</span>
                                    </button>

                                    <button
                                        className={`editor-nav-item ${editorSection === "extras" ? "active" : ""}`}
                                        onClick={() => setEditorSection("extras")}
                                    >
                                        <span className="section-dot"></span>
                                        <span className="section-name">🏆 Honors & Certs</span>
                                    </button>
                                </div>

                                <div className="sidebar-footer-card">
                                    <button
                                        className="btn-primary full-width"
                                        onClick={handleSubmitResume}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <span className="spinner"></span> Analyzing with AI...
                                            </>
                                        ) : (
                                            "💾 Save & Analyze with AI"
                                        )}
                                    </button>
                                    <button className="btn-secondary full-width" onClick={() => setActiveTab("preview")}>
                                        👁️ View Live Preview
                                    </button>
                                </div>
                            </aside>

                            {/* Main Form Fields Container */}
                            <div className="editor-fields-panel">
                                {/* SECTION: PERSONAL DETAILS */}
                                {editorSection === "personal" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Personal & Contact Information</h2>
                                                <p>Recruiters use these details to contact you and inspect your portfolio.</p>
                                            </div>
                                        </div>

                                        <div className="form-grid-2">
                                            <div className="form-group">
                                                <label>Full Name <span className="req">*</span></label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Alex Johnson"
                                                    value={personalInfo.name}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Professional Title / Headline</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Senior Full Stack Engineer"
                                                    value={personalInfo.title}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, title: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Email Address</label>
                                                <input
                                                    type="email"
                                                    placeholder="alex@example.com"
                                                    value={personalInfo.email}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Phone Number</label>
                                                <input
                                                    type="tel"
                                                    placeholder="+1 (555) 234-5678"
                                                    value={personalInfo.phone}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Location (City, Country)</label>
                                                <input
                                                    type="text"
                                                    placeholder="San Francisco, CA"
                                                    value={personalInfo.location}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Portfolio / Website URL</label>
                                                <input
                                                    type="url"
                                                    placeholder="https://alexjohnson.dev"
                                                    value={personalInfo.website}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, website: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>LinkedIn Profile</label>
                                                <input
                                                    type="text"
                                                    placeholder="linkedin.com/in/alexjohnson"
                                                    value={personalInfo.linkedin}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>GitHub Profile</label>
                                                <input
                                                    type="text"
                                                    placeholder="github.com/alexjohnson"
                                                    value={personalInfo.github}
                                                    onChange={(e) => setPersonalInfo({ ...personalInfo, github: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="section-next-action">
                                            <button className="btn-primary" onClick={() => setEditorSection("summary")}>
                                                Next: Summary & AI Pitch →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: SUMMARY */}
                                {editorSection === "summary" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Professional Summary & AI Enhancement</h2>
                                                <p>A concise, impactful elevator pitch. Let Gemini AI elevate your phrasing with action verbs.</p>
                                            </div>
                                            <button
                                                className="btn-ai-magic"
                                                onClick={handleImproveSummary}
                                                disabled={aiImprovingSummary}
                                            >
                                                {aiImprovingSummary ? (
                                                    <>
                                                        <span className="spinner"></span> Gemini Polishing...
                                                    </>
                                                ) : (
                                                    "✨ Polish with AI"
                                                )}
                                            </button>
                                        </div>

                                        <div className="form-group">
                                            <label>Summary Draft</label>
                                            <textarea
                                                rows={5}
                                                placeholder="e.g. Results-driven Software Engineer with 4+ years of experience building scalable distributed web applications with React and Node.js..."
                                                value={summary}
                                                onChange={(e) => setSummary(e.target.value)}
                                            />
                                            <div className="field-hint">
                                                <span>💡 Tip: Click "✨ Polish with AI" to let Gemini optimize your summary for ATS recruiters.</span>
                                            </div>
                                        </div>

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("personal")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={() => setEditorSection("experience")}>
                                                Next: Work Experience →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: EXPERIENCE */}
                                {editorSection === "experience" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Work Experience</h2>
                                                <p>Highlight your roles, quantifiable achievements, and technical contributions.</p>
                                            </div>
                                            <button className="btn-outline-sm" onClick={() => addRow(setExperience, emptyExperience)}>
                                                + Add Another Job
                                            </button>
                                        </div>

                                        {experience.map((exp, idx) => (
                                            <div key={idx} className="nested-item-card">
                                                <div className="item-card-top">
                                                    <span className="item-counter">Experience #{idx + 1}</span>
                                                    {experience.length > 1 && (
                                                        <button className="item-remove-btn" onClick={() => removeRow(setExperience, idx)}>
                                                            ✕ Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="form-grid-2">
                                                    <div className="form-group">
                                                        <label>Job Title / Role</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Senior Frontend Engineer"
                                                            value={exp.role}
                                                            onChange={(e) => updateArrayRow(setExperience, idx, "role", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Company / Organization</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Google, Stripe, Tech Startup"
                                                            value={exp.company}
                                                            onChange={(e) => updateArrayRow(setExperience, idx, "company", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Duration / Dates</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Jan 2022 – Present"
                                                            value={exp.duration}
                                                            onChange={(e) => updateArrayRow(setExperience, idx, "duration", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Location</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. New York, NY (Remote)"
                                                            value={exp.location}
                                                            onChange={(e) => updateArrayRow(setExperience, idx, "location", e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="form-group" style={{ marginTop: "12px" }}>
                                                    <label>Responsibilities & Achievements</label>
                                                    <textarea
                                                        rows={3}
                                                        placeholder="• Architected real-time dashboard microfrontends reducing latency by 42%&#10;• Mentored 5 junior engineers and led sprint planning"
                                                        value={exp.description}
                                                        onChange={(e) => updateArrayRow(setExperience, idx, "description", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("summary")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={() => setEditorSection("projects")}>
                                                Next: Key Projects →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: PROJECTS */}
                                {editorSection === "projects" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Key Projects & Portfolio</h2>
                                                <p>Showcase technical projects. Use Gemini to polish descriptions with impactful tech verbs.</p>
                                            </div>
                                            <button className="btn-outline-sm" onClick={() => addRow(setProjects, emptyProject)}>
                                                + Add Another Project
                                            </button>
                                        </div>

                                        {projects.map((proj, idx) => (
                                            <div key={idx} className="nested-item-card">
                                                <div className="item-card-top">
                                                    <span className="item-counter">Project #{idx + 1}</span>
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <button
                                                            className="btn-ai-magic-sm"
                                                            onClick={() => handleImproveProject(idx)}
                                                            disabled={aiImprovingProjectIdx === idx}
                                                        >
                                                            {aiImprovingProjectIdx === idx ? "✨ Enhancing..." : "✨ AI Polish Description"}
                                                        </button>
                                                        {projects.length > 1 && (
                                                            <button className="item-remove-btn" onClick={() => removeRow(setProjects, idx)}>
                                                                ✕ Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="form-grid-2">
                                                    <div className="form-group">
                                                        <label>Project Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. AI Resume Studio"
                                                            value={proj.title}
                                                            onChange={(e) => updateArrayRow(setProjects, idx, "title", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Tech Stack Used</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. React, Node.js, MongoDB, Gemini API"
                                                            value={proj.techStack}
                                                            onChange={(e) => updateArrayRow(setProjects, idx, "techStack", e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="form-group" style={{ marginTop: "12px" }}>
                                                    <label>Project Description & Impact</label>
                                                    <textarea
                                                        rows={3}
                                                        placeholder="Built an automated resume intelligence application supporting live PDF generation and Gemini LLM analysis."
                                                        value={proj.description}
                                                        onChange={(e) => updateArrayRow(setProjects, idx, "description", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("experience")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={() => setEditorSection("education")}>
                                                Next: Education →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: EDUCATION */}
                                {editorSection === "education" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Education Background</h2>
                                                <p>Add your degrees, universities, certifications, or coursework.</p>
                                            </div>
                                            <button className="btn-outline-sm" onClick={() => addRow(setEducation, emptyEducation)}>
                                                + Add Education
                                            </button>
                                        </div>

                                        {education.map((edu, idx) => (
                                            <div key={idx} className="nested-item-card">
                                                <div className="item-card-top">
                                                    <span className="item-counter">Education #{idx + 1}</span>
                                                    {education.length > 1 && (
                                                        <button className="item-remove-btn" onClick={() => removeRow(setEducation, idx)}>
                                                            ✕ Remove
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="form-grid-2">
                                                    <div className="form-group">
                                                        <label>Degree / Qualification</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. B.S. in Computer Science"
                                                            value={edu.degree}
                                                            onChange={(e) => updateArrayRow(setEducation, idx, "degree", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Institution / University</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Stanford University"
                                                            value={edu.institution}
                                                            onChange={(e) => updateArrayRow(setEducation, idx, "institution", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>Graduation Year / Duration</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 2020 – 2024"
                                                            value={edu.year}
                                                            onChange={(e) => updateArrayRow(setEducation, idx, "year", e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label>GPA / Honors (Optional)</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 3.9 / 4.0, Magna Cum Laude"
                                                            value={edu.gpa}
                                                            onChange={(e) => updateArrayRow(setEducation, idx, "gpa", e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("projects")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={() => setEditorSection("skills")}>
                                                Next: Skills & Tech Stack →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: SKILLS */}
                                {editorSection === "skills" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Skills & Technologies</h2>
                                                <p>Add your technical and domain skills. Click popular tags for quick 1-click addition.</p>
                                            </div>
                                        </div>

                                        {/* Skill Tag Cloud */}
                                        <div className="skills-cloud-box">
                                            <label>Current Selected Skills ({skillsList.length})</label>
                                            <div className="active-tags-wrapper">
                                                {skillsList.length > 0 ? (
                                                    skillsList.map((skill, i) => (
                                                        <span key={i} className="skill-tag-pill">
                                                            {skill}
                                                            <button type="button" onClick={() => removeSkillTag(skill)}>✕</button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="no-skills-msg">No skills added yet. Type below or click popular suggestions.</span>
                                                )}
                                            </div>

                                            {/* Custom Skill Input */}
                                            <div className="add-skill-input-row">
                                                <input
                                                    type="text"
                                                    placeholder="Type skill and press Enter (e.g. GraphQL, Tailwind, Docker)..."
                                                    value={skillInput}
                                                    onChange={(e) => setSkillInput(e.target.value)}
                                                    onKeyDown={handleCustomSkillAdd}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-outline-sm"
                                                    onClick={() => {
                                                        if (skillInput.trim()) {
                                                            addSkillTag(skillInput.trim());
                                                            setSkillInput("");
                                                        }
                                                    }}
                                                >
                                                    + Add
                                                </button>
                                            </div>
                                        </div>

                                        {/* Quick Suggestion Chips */}
                                        <div className="popular-skills-suggestions">
                                            <label>💡 Quick Add Popular Tech Skills:</label>
                                            <div className="suggestion-chips-grid">
                                                {POPULAR_SKILLS.map((item, idx) => {
                                                    const isSelected = skillsList.includes(item);
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            className={`suggestion-chip ${isSelected ? "selected" : ""}`}
                                                            onClick={() => (isSelected ? removeSkillTag(item) : addSkillTag(item))}
                                                        >
                                                            {isSelected ? "✓ " : "+ "} {item}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("education")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={() => setEditorSection("extras")}>
                                                Next: Honors & Certifications →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* SECTION: EXTRAS (CERTS & AWARDS) */}
                                {editorSection === "extras" && (
                                    <div className="form-section-card animate-fade">
                                        <div className="section-card-header">
                                            <div>
                                                <h2>Certifications, Honors & Awards</h2>
                                                <p>Distinguish yourself with relevant certifications, licenses, and recognitions.</p>
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Certifications (Comma separated)</label>
                                            <input
                                                type="text"
                                                placeholder="AWS Certified Solutions Architect, Google Cloud Professional, Meta Frontend Specialist"
                                                value={certificationsText}
                                                onChange={(e) => setCertificationsText(e.target.value)}
                                            />
                                        </div>

                                        <div className="form-group" style={{ marginTop: "16px" }}>
                                            <label>Awards & Honors (Comma separated)</label>
                                            <input
                                                type="text"
                                                placeholder="Hackathon 1st Place Winner 2024, Dean's Honor List, Outstanding Engineer Award"
                                                value={awardsText}
                                                onChange={(e) => setAwardsText(e.target.value)}
                                            />
                                        </div>

                                        <div className="section-next-action">
                                            <button className="btn-secondary" onClick={() => setEditorSection("skills")}>
                                                ← Back
                                            </button>
                                            <button className="btn-primary" onClick={handleSubmitResume} disabled={submitting}>
                                                {submitting ? "Analyzing..." : "💾 Save & Analyze All"}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: LIVE TEMPLATE PREVIEW & CUSTOMIZER                     */}
                {/* ============================================================== */}
                {activeTab === "preview" && (
                    <div className="tab-content preview-tab animate-fade">
                        {/* Customization Toolbar */}
                        <div className="preview-toolbar-card">
                            <div className="toolbar-left">
                                <div className="template-selector-group">
                                    <label>Template Style:</label>
                                    <div className="template-btn-pill-group">
                                        <button
                                            className={`pill-btn ${selectedTemplate === "modern" ? "active" : ""}`}
                                            onClick={() => setSelectedTemplate("modern")}
                                        >
                                            Modern Pro
                                        </button>
                                        <button
                                            className={`pill-btn ${selectedTemplate === "minimal" ? "active" : ""}`}
                                            onClick={() => setSelectedTemplate("minimal")}
                                        >
                                            Minimalist ATS
                                        </button>
                                        <button
                                            className={`pill-btn ${selectedTemplate === "tech" ? "active" : ""}`}
                                            onClick={() => setSelectedTemplate("tech")}
                                        >
                                            Tech Indigo
                                        </button>
                                        <button
                                            className={`pill-btn ${selectedTemplate === "executive" ? "active" : ""}`}
                                            onClick={() => setSelectedTemplate("executive")}
                                        >
                                            Executive Bold
                                        </button>
                                    </div>
                                </div>

                                <div className="palette-selector-group">
                                    <label>Accent Color:</label>
                                    <div className="color-swatches">
                                        {COLOR_PALETTES.map((palette) => (
                                            <button
                                                key={palette.id}
                                                className={`swatch-btn ${selectedPalette.id === palette.id ? "selected" : ""}`}
                                                style={{ background: palette.primary }}
                                                onClick={() => setSelectedPalette(palette)}
                                                title={palette.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="toolbar-right">
                                <button className="btn-primary" onClick={downloadPdf}>
                                    📄 Export PDF
                                </button>
                                <button className="btn-secondary" onClick={downloadAsWord}>
                                    📝 Word (.doc)
                                </button>
                                <button className="btn-secondary" onClick={handlePrint}>
                                    🖨️ Print View
                                </button>
                            </div>
                        </div>

                        {/* Resume Paper Canvas Preview */}
                        <div className="resume-paper-viewport">
                            <div className={`resume-paper-sheet template-${selectedTemplate}`} id="printable-resume">
                                {/* ========================================== */}
                                {/* TEMPLATE 1: MODERN PRO (2-Column Layout)   */}
                                {/* ========================================== */}
                                {selectedTemplate === "modern" && (
                                    <div className="modern-template-layout">
                                        <aside className="modern-left-sidebar" style={{ borderRightColor: selectedPalette.border, background: selectedPalette.accent }}>
                                            <div className="modern-avatar-badge" style={{ background: selectedPalette.primary }}>
                                                {pictureUrl ? (
                                                    <img src={pictureUrl} alt={personalInfo.name} />
                                                ) : (
                                                    (personalInfo.name || user?.name || "U").charAt(0).toUpperCase()
                                                )}
                                            </div>

                                            <div className="sidebar-section">
                                                <h4 style={{ color: selectedPalette.primary }}>CONTACT</h4>
                                                <p>{personalInfo.email || user?.email || "email@example.com"}</p>
                                                <p>{personalInfo.phone || user?.phone || "+1 555-0199"}</p>
                                                <p>{personalInfo.location || "City, Country"}</p>
                                                {personalInfo.linkedin && <p>{personalInfo.linkedin}</p>}
                                                {personalInfo.github && <p>{personalInfo.github}</p>}
                                                {personalInfo.website && <p>{personalInfo.website}</p>}
                                            </div>

                                            {skillsList.length > 0 && (
                                                <div className="sidebar-section">
                                                    <h4 style={{ color: selectedPalette.primary }}>CORE SKILLS</h4>
                                                    <div className="modern-skill-tags">
                                                        {skillsList.map((s, i) => (
                                                            <span key={i} className="modern-skill-pill" style={{ borderColor: selectedPalette.border }}>
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {education.some((e) => e.degree || e.institution) && (
                                                <div className="sidebar-section">
                                                    <h4 style={{ color: selectedPalette.primary }}>EDUCATION</h4>
                                                    {education.filter((e) => e.degree || e.institution).map((edu, i) => (
                                                        <div key={i} className="sidebar-edu-item">
                                                            <strong>{edu.degree}</strong>
                                                            <p>{edu.institution}</p>
                                                            <span>{edu.year}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </aside>

                                        <main className="modern-main-content">
                                            <header className="modern-header">
                                                <h1 style={{ color: selectedPalette.primary }}>{personalInfo.name || user?.name || "Your Full Name"}</h1>
                                                <h2>{personalInfo.title || "Software Engineer & Designer"}</h2>
                                            </header>

                                            {(summary || resume?.summary) && (
                                                <section className="resume-section">
                                                    <h3 className="section-title" style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.border }}>
                                                        PROFILE SUMMARY
                                                    </h3>
                                                    <p className="resume-body-text">{summary || resume?.summary}</p>
                                                </section>
                                            )}

                                            {experience.some((e) => e.role || e.company) && (
                                                <section className="resume-section">
                                                    <h3 className="section-title" style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.border }}>
                                                        EXPERIENCE
                                                    </h3>
                                                    {experience.filter((e) => e.role || e.company).map((exp, i) => (
                                                        <div key={i} className="resume-entry">
                                                            <div className="entry-header">
                                                                <h4>{exp.role}</h4>
                                                                <span className="entry-dates">{exp.duration}</span>
                                                            </div>
                                                            <div className="entry-sub">
                                                                <strong>{exp.company}</strong> {exp.location && `• ${exp.location}`}
                                                            </div>
                                                            <p className="resume-body-text">{exp.description}</p>
                                                        </div>
                                                    ))}
                                                </section>
                                            )}

                                            {projects.some((p) => p.title) && (
                                                <section className="resume-section">
                                                    <h3 className="section-title" style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.border }}>
                                                        PROJECTS
                                                    </h3>
                                                    {projects.filter((p) => p.title).map((proj, i) => (
                                                        <div key={i} className="resume-entry">
                                                            <div className="entry-header">
                                                                <h4>{proj.title}</h4>
                                                                {proj.techStack && <span className="entry-tech" style={{ color: selectedPalette.primary }}>{proj.techStack}</span>}
                                                            </div>
                                                            <p className="resume-body-text">{proj.description}</p>
                                                        </div>
                                                    ))}
                                                </section>
                                            )}
                                        </main>
                                    </div>
                                )}

                                {/* ========================================== */}
                                {/* TEMPLATE 2: MINIMALIST ATS (Single-Col)    */}
                                {/* ========================================== */}
                                {selectedTemplate === "minimal" && (
                                    <div className="minimal-template-layout">
                                        <header className="minimal-header">
                                            <h1>{personalInfo.name || user?.name || "Your Full Name"}</h1>
                                            {personalInfo.title && <h2>{personalInfo.title}</h2>}
                                            <div className="minimal-contact-line">
                                                <span>{personalInfo.email || user?.email}</span>
                                                <span>•</span>
                                                <span>{personalInfo.phone || user?.phone}</span>
                                                <span>•</span>
                                                <span>{personalInfo.location}</span>
                                                {personalInfo.linkedin && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{personalInfo.linkedin}</span>
                                                    </>
                                                )}
                                                {personalInfo.github && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{personalInfo.github}</span>
                                                    </>
                                                )}
                                            </div>
                                        </header>

                                        {(summary || resume?.summary) && (
                                            <section className="minimal-section">
                                                <h3 style={{ borderBottomColor: selectedPalette.primary, color: selectedPalette.primary }}>PROFESSIONAL SUMMARY</h3>
                                                <p className="resume-body-text">{summary || resume?.summary}</p>
                                            </section>
                                        )}

                                        {skillsList.length > 0 && (
                                            <section className="minimal-section">
                                                <h3 style={{ borderBottomColor: selectedPalette.primary, color: selectedPalette.primary }}>TECHNICAL SKILLS</h3>
                                                <p className="resume-body-text">{skillsList.join("  •  ")}</p>
                                            </section>
                                        )}

                                        {experience.some((e) => e.role || e.company) && (
                                            <section className="minimal-section">
                                                <h3 style={{ borderBottomColor: selectedPalette.primary, color: selectedPalette.primary }}>PROFESSIONAL EXPERIENCE</h3>
                                                {experience.filter((e) => e.role || e.company).map((exp, i) => (
                                                    <div key={i} className="minimal-entry">
                                                        <div className="entry-line-1">
                                                            <strong>{exp.role}</strong>
                                                            <span>{exp.duration}</span>
                                                        </div>
                                                        <div className="entry-line-2">
                                                            <span>{exp.company}</span>
                                                            <span>{exp.location}</span>
                                                        </div>
                                                        <p className="resume-body-text">{exp.description}</p>
                                                    </div>
                                                ))}
                                            </section>
                                        )}

                                        {projects.some((p) => p.title) && (
                                            <section className="minimal-section">
                                                <h3 style={{ borderBottomColor: selectedPalette.primary, color: selectedPalette.primary }}>KEY PROJECTS</h3>
                                                {projects.filter((p) => p.title).map((proj, i) => (
                                                    <div key={i} className="minimal-entry">
                                                        <div className="entry-line-1">
                                                            <strong>{proj.title}</strong>
                                                            {proj.techStack && <em>({proj.techStack})</em>}
                                                        </div>
                                                        <p className="resume-body-text">{proj.description}</p>
                                                    </div>
                                                ))}
                                            </section>
                                        )}

                                        {education.some((e) => e.degree || e.institution) && (
                                            <section className="minimal-section">
                                                <h3 style={{ borderBottomColor: selectedPalette.primary, color: selectedPalette.primary }}>EDUCATION</h3>
                                                {education.filter((e) => e.degree || e.institution).map((edu, i) => (
                                                    <div key={i} className="minimal-entry">
                                                        <div className="entry-line-1">
                                                            <strong>{edu.degree}</strong>
                                                            <span>{edu.year}</span>
                                                        </div>
                                                        <div className="entry-line-2">
                                                            <span>{edu.institution}</span>
                                                            {edu.gpa && <span>GPA: {edu.gpa}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </section>
                                        )}
                                    </div>
                                )}

                                {/* ========================================== */}
                                {/* TEMPLATE 3: TECH INDIGO                   */}
                                {/* ========================================== */}
                                {selectedTemplate === "tech" && (
                                    <div className="tech-template-layout">
                                        <header className="tech-header" style={{ borderLeftColor: selectedPalette.primary }}>
                                            <div className="tech-title-block">
                                                <h1>{personalInfo.name || user?.name || "Your Full Name"}</h1>
                                                <div className="tech-tag-badge" style={{ background: selectedPalette.accent, color: selectedPalette.primary }}>
                                                    {personalInfo.title || "Full Stack Developer"}
                                                </div>
                                            </div>
                                            <div className="tech-contact-grid">
                                                <span>📧 {personalInfo.email || user?.email}</span>
                                                <span>📱 {personalInfo.phone || user?.phone}</span>
                                                <span>📍 {personalInfo.location}</span>
                                                {personalInfo.github && <span>💻 {personalInfo.github}</span>}
                                            </div>
                                        </header>

                                        {(summary || resume?.summary) && (
                                            <section className="tech-section">
                                                <div className="tech-section-badge" style={{ background: selectedPalette.primary }}>ABOUT ME</div>
                                                <p className="resume-body-text">{summary || resume?.summary}</p>
                                            </section>
                                        )}

                                        {skillsList.length > 0 && (
                                            <section className="tech-section">
                                                <div className="tech-section-badge" style={{ background: selectedPalette.primary }}>TECH STACK</div>
                                                <div className="tech-chips-flow">
                                                    {skillsList.map((s, i) => (
                                                        <span key={i} className="tech-chip-item" style={{ borderColor: selectedPalette.border, background: selectedPalette.accent }}>
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {experience.some((e) => e.role || e.company) && (
                                            <section className="tech-section">
                                                <div className="tech-section-badge" style={{ background: selectedPalette.primary }}>EXPERIENCE</div>
                                                {experience.filter((e) => e.role || e.company).map((exp, i) => (
                                                    <div key={i} className="tech-timeline-item" style={{ borderLeftColor: selectedPalette.border }}>
                                                        <div className="tech-dot" style={{ background: selectedPalette.primary }}></div>
                                                        <div className="tech-item-header">
                                                            <strong>{exp.role}</strong>
                                                            <span className="tech-date-tag">{exp.duration}</span>
                                                        </div>
                                                        <p className="tech-company">{exp.company} — {exp.location}</p>
                                                        <p className="resume-body-text">{exp.description}</p>
                                                    </div>
                                                ))}
                                            </section>
                                        )}

                                        {projects.some((p) => p.title) && (
                                            <section className="tech-section">
                                                <div className="tech-section-badge" style={{ background: selectedPalette.primary }}>PROJECTS</div>
                                                {projects.filter((p) => p.title).map((proj, i) => (
                                                    <div key={i} className="tech-project-box" style={{ borderColor: selectedPalette.border }}>
                                                        <div className="tech-item-header">
                                                            <strong>{proj.title}</strong>
                                                            {proj.techStack && <span style={{ color: selectedPalette.primary }}>{proj.techStack}</span>}
                                                        </div>
                                                        <p className="resume-body-text">{proj.description}</p>
                                                    </div>
                                                ))}
                                            </section>
                                        )}
                                    </div>
                                )}

                                {/* ========================================== */}
                                {/* TEMPLATE 4: EXECUTIVE BOLD                */}
                                {/* ========================================== */}
                                {selectedTemplate === "executive" && (
                                    <div className="executive-template-layout">
                                        <header className="executive-header" style={{ background: selectedPalette.primary }}>
                                            <h1>{personalInfo.name || user?.name || "Your Full Name"}</h1>
                                            <h2>{personalInfo.title || "Senior Executive"}</h2>
                                            <p>{[personalInfo.email || user?.email, personalInfo.phone || user?.phone, personalInfo.location].filter(Boolean).join("  |  ")}</p>
                                        </header>

                                        {(summary || resume?.summary) && (
                                            <section className="exec-section">
                                                <h3 style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.primary }}>EXECUTIVE PROFILE</h3>
                                                <p className="resume-body-text">{summary || resume?.summary}</p>
                                            </section>
                                        )}

                                        {experience.some((e) => e.role || e.company) && (
                                            <section className="exec-section">
                                                <h3 style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.primary }}>CAREER HISTORY</h3>
                                                {experience.filter((e) => e.role || e.company).map((exp, i) => (
                                                    <div key={i} className="exec-entry">
                                                        <div className="exec-row">
                                                            <strong>{exp.role}</strong>
                                                            <span>{exp.duration}</span>
                                                        </div>
                                                        <div className="exec-sub">{exp.company} — {exp.location}</div>
                                                        <p className="resume-body-text">{exp.description}</p>
                                                    </div>
                                                ))}
                                            </section>
                                        )}

                                        {education.some((e) => e.degree || e.institution) && (
                                            <section className="exec-section">
                                                <h3 style={{ color: selectedPalette.primary, borderBottomColor: selectedPalette.primary }}>EDUCATION & CREDENTIALS</h3>
                                                {education.filter((e) => e.degree || e.institution).map((edu, i) => (
                                                    <div key={i} className="exec-entry">
                                                        <div className="exec-row">
                                                            <strong>{edu.degree}</strong>
                                                            <span>{edu.year}</span>
                                                        </div>
                                                        <div className="exec-sub">{edu.institution}</div>
                                                    </div>
                                                ))}
                                            </section>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 4: AI CAREER COACH & ATS TIPS                             */}
                {/* ============================================================== */}
                {activeTab === "coach" && (
                    <div className="tab-content coach-tab animate-fade">
                        <div className="coach-hero-banner">
                            <div className="coach-hero-text">
                                <div className="welcome-badge">🤖 Gemini Career Intelligence</div>
                                <h1>AI Career & ATS Optimization Advisor</h1>
                                <p>Get personalized suggestions, keyword optimization tips, and power verbs to boost interview calls.</p>
                            </div>
                        </div>

                        <div className="coach-cards-grid">
                            {/* Card 1: Action Verb Booster */}
                            <div className="coach-card">
                                <div className="coach-card-icon" style={{ background: "#eef2ff", color: "#4f46e5" }}>⚡</div>
                                <h3>High-Impact Power Verbs</h3>
                                <p>Replace passive phrases with strong engineering and leadership action verbs:</p>
                                <div className="verb-tags-group">
                                    <span className="verb-tag">Architected</span>
                                    <span className="verb-tag">Accelerated</span>
                                    <span className="verb-tag">Spearheaded</span>
                                    <span className="verb-tag">Optimized</span>
                                    <span className="verb-tag">Streamlined</span>
                                    <span className="verb-tag">Engineered</span>
                                    <span className="verb-tag">Pioneered</span>
                                    <span className="verb-tag">Orchestrated</span>
                                </div>
                            </div>

                            {/* Card 2: ATS Scanner Checklist */}
                            <div className="coach-card">
                                <div className="coach-card-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🎯</div>
                                <h3>ATS Passing Checklist</h3>
                                <ul className="coach-checklist">
                                    <li className={personalInfo.email && personalInfo.phone ? "done" : ""}>
                                        {personalInfo.email && personalInfo.phone ? "✓" : "○"} Standard contact details present
                                    </li>
                                    <li className={skillsList.length >= 5 ? "done" : ""}>
                                        {skillsList.length >= 5 ? "✓" : "○"} Minimum 5 relevant technical skill keywords
                                    </li>
                                    <li className={summary.length > 40 ? "done" : ""}>
                                        {summary.length > 40 ? "✓" : "○"} Tailored summary pitch with role title
                                    </li>
                                    <li className={projects.length >= 1 ? "done" : ""}>
                                        {projects.length >= 1 ? "✓" : "○"} Quantifiable metrics & achievements in projects
                                    </li>
                                </ul>
                            </div>

                            {/* Card 3: Interactive Chat Prompts */}
                            <div className="coach-card">
                                <div className="coach-card-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>💬</div>
                                <h3>Try Asking Gemini Assistant</h3>
                                <p>Click the floating chat widget on the bottom right and ask questions like:</p>
                                <div className="prompt-suggestions">
                                    <div className="prompt-pill">"How can I make my project bullet points more metrics-focused?"</div>
                                    <div className="prompt-pill">"What skills should I add for a Senior Full Stack role?"</div>
                                    <div className="prompt-pill">"Help me prepare for technical interviews based on my resume."</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Edit Profile Modal */}
            {showEditProfile && (
                <div className="modal-overlay" onClick={() => !savingProfile && setShowEditProfile(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Edit My Profile</h3>

                        <div className="modal-avatar-row">
                            <div className="profile-avatar-lg">
                                {pictureUrl ? (
                                    <img src={pictureUrl} alt={user?.name} />
                                ) : (
                                    user?.name?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div>
                                <input
                                    ref={pictureInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    onChange={handlePictureInput}
                                    disabled={uploadingPicture}
                                    hidden
                                />
                                <button
                                    className="btn-outline-sm"
                                    type="button"
                                    onClick={() => pictureInputRef.current?.click()}
                                    disabled={uploadingPicture}
                                >
                                    {uploadingPicture ? "Uploading..." : "📷 Change Photo"}
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ textAlign: "left", marginBottom: "14px" }}>
                            <label>Bio / About Me</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={300}
                                rows={3}
                                placeholder="Tell us about your background and interests..."
                            />
                        </div>

                        <div className="form-group" style={{ textAlign: "left", marginBottom: "6px" }}>
                            <label>Phone number</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 (555) 234-5678"
                            />
                        </div>

                        {profileError && (
                            <div className="error-message" style={{ marginTop: "12px" }}>
                                <span>⚠</span>{profileError}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowEditProfile(false)} disabled={savingProfile}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                                {savingProfile ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Resume Information?</h3>
                        <p>This action will erase your entered resume data from the server. You can enter new info anytime.</p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDeleteConfirmed}>Delete Permanently</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Toast Notification */}
            {toast && <div className="toast animate-toast">{toast}</div>}

            {/* AI Assistant Chat Widget */}
            <ChatWidget />
        </div>
    );
}

export default UserDashboard;