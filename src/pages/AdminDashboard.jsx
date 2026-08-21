import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAllResumes,
    deleteResume,
    getAllUsers,
    deleteUser,
    getAdminStats,
} from "../services/adminService";
import api from "../services/api";
import jsPDF from "jspdf";
import "./AdminDashboard.css";

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, "");

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function AdminDashboard() {
    const navigate = useNavigate();

    const [admin, setAdmin] = useState(null);
    const [resumes, setResumes] = useState([]);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");

    // Active Navigation Tab: 'overview' | 'resumes' | 'users'
    const [activeTab, setActiveTab] = useState("overview");

    // Search and filter state
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'has_resume' | 'has_experience'
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

    // Selected candidate detail modal
    const [selectedResume, setSelectedResume] = useState(null);

    // Deletion states
    const [resumeToDelete, setResumeToDelete] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!token || !storedUser) {
            navigate("/login");
            return;
        }

        try {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.role !== "admin") {
                navigate("/dashboard");
                return;
            }
            setAdmin(parsedUser);
        } catch (e) {
            navigate("/login");
            return;
        }

        loadAllAdminData();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(""), 3500);
        return () => clearTimeout(timer);
    }, [toast]);

    const loadAllAdminData = async () => {
        setLoading(true);
        setError("");
        try {
            const [resumesData, usersData, statsData] = await Promise.all([
                getAllResumes(),
                getAllUsers(),
                getAdminStats(),
            ]);

            if (resumesData.success) setResumes(resumesData.resumes || []);
            if (usersData.success) setUsers(usersData.users || []);
            if (statsData.success) setStats(statsData.stats || null);
        } catch (err) {
            console.error("Failed to load admin data:", err);
            setError(err.response?.data?.message || "Failed to load admin dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const handleConfirmDeleteResume = async () => {
        if (!resumeToDelete) return;
        setDeleting(true);
        try {
            await deleteResume(resumeToDelete._id);
            setResumes((prev) => prev.filter((r) => r._id !== resumeToDelete._id));
            if (selectedResume?._id === resumeToDelete._id) {
                setSelectedResume(null);
            }
            setResumeToDelete(null);
            setToast("Resume deleted successfully");
            // Refresh stats
            const statsData = await getAdminStats();
            if (statsData.success) setStats(statsData.stats);
        } catch (err) {
            console.error("Failed to delete resume:", err);
            setError(err.response?.data?.message || "Failed to delete resume");
        } finally {
            setDeleting(false);
        }
    };

    const handleConfirmDeleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            await deleteUser(userToDelete._id);
            setUsers((prev) => prev.filter((u) => u._id !== userToDelete._id));
            setResumes((prev) => prev.filter((r) => r.user?._id !== userToDelete._id));
            setUserToDelete(null);
            setToast("User account and data removed");
            // Refresh stats
            const statsData = await getAdminStats();
            if (statsData.success) setStats(statsData.stats);
        } catch (err) {
            console.error("Failed to delete user:", err);
            setError(err.response?.data?.message || "Failed to delete user");
        } finally {
            setDeleting(false);
        }
    };

    // Full Candidate PDF Export using jsPDF
    const downloadCandidatePdf = (candidateResume) => {
        if (!candidateResume) return;

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 16;
        const contentWidth = pageWidth - margin * 2;
        let y = 18;

        const candidateName =
            candidateResume.personalInfo?.name || candidateResume.user?.name || "Candidate";
        const candidateTitle = candidateResume.personalInfo?.title || "Professional Profile";
        const candidateEmail = candidateResume.personalInfo?.email || candidateResume.user?.email || "";
        const candidatePhone = candidateResume.personalInfo?.phone || candidateResume.user?.phone || "";
        const candidateLocation = candidateResume.personalInfo?.location || "";

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(candidateName, margin, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(67, 56, 202);
        doc.text(candidateTitle, margin, y);
        y += 6;

        // Contact info line
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        const contacts = [
            candidateEmail,
            candidatePhone,
            candidateLocation,
            candidateResume.personalInfo?.linkedin,
            candidateResume.personalInfo?.github,
        ].filter(Boolean);

        const contactLine = contacts.join("  •  ");
        const splitContact = doc.splitTextToSize(contactLine, contentWidth);
        doc.text(splitContact, margin, y);
        y += splitContact.length * 4.5 + 4;

        // Accent Divider
        doc.setDrawColor(67, 56, 202);
        doc.setLineWidth(0.8);
        doc.line(margin, y, pageWidth - margin, y);
        y += 7;

        const checkPageBreak = (neededHeight) => {
            if (y + neededHeight > 280) {
                doc.addPage();
                y = 16;
            }
        };

        const renderSectionHeader = (title) => {
            checkPageBreak(12);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(67, 56, 202);
            doc.text(title.toUpperCase(), margin, y);
            y += 2;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 5;
        };

        // Gemini AI Recruiter Summary
        if (candidateResume.summary) {
            renderSectionHeader("AI Recruiter Summary");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 41, 59);
            const sumLines = doc.splitTextToSize(candidateResume.summary, contentWidth);
            checkPageBreak(sumLines.length * 4.5);
            doc.text(sumLines, margin, y);
            y += sumLines.length * 4.5 + 4;
        }

        // Work Experience
        const expList = (candidateResume.experience || []).filter((e) => e.role || e.company);
        if (expList.length > 0) {
            renderSectionHeader("Work Experience");
            expList.forEach((exp) => {
                checkPageBreak(16);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.text(exp.role || "Role", margin, y);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                const durText = exp.duration || "";
                const durWidth = doc.getTextWidth(durText);
                doc.text(durText, pageWidth - margin - durWidth, y);
                y += 4.5;

                doc.setFont("helvetica", "italic");
                doc.setTextColor(71, 85, 105);
                const compLine = [exp.company, exp.location].filter(Boolean).join(" — ");
                doc.text(compLine, margin, y);
                y += 4.5;

                if (exp.description) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(51, 65, 85);
                    const descLines = doc.splitTextToSize(exp.description, contentWidth);
                    checkPageBreak(descLines.length * 4);
                    doc.text(descLines, margin, y);
                    y += descLines.length * 4 + 3;
                }
                y += 2;
            });
        }

        // Key Projects
        const projList = (candidateResume.projects || []).filter((p) => p.title || p.description);
        if (projList.length > 0) {
            renderSectionHeader("Key Projects");
            projList.forEach((proj) => {
                checkPageBreak(14);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(15, 23, 42);
                doc.text(proj.title || "Project", margin, y);

                if (proj.techStack) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(8.5);
                    doc.setTextColor(67, 56, 202);
                    doc.text(` (${proj.techStack})`, margin + doc.getTextWidth(proj.title) + 2, y);
                }
                y += 4.5;

                if (proj.description) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(51, 65, 85);
                    const descLines = doc.splitTextToSize(proj.description, contentWidth);
                    checkPageBreak(descLines.length * 4);
                    doc.text(descLines, margin, y);
                    y += descLines.length * 4 + 3;
                }
                y += 2;
            });
        }

        // Skills
        const skillsList = candidateResume.skills || [];
        if (skillsList.length > 0) {
            renderSectionHeader("Skills & Expertise");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(30, 41, 59);
            const skillsLine = skillsList.join("  •  ");
            const splitSkills = doc.splitTextToSize(skillsLine, contentWidth);
            checkPageBreak(splitSkills.length * 4.5);
            doc.text(splitSkills, margin, y);
            y += splitSkills.length * 4.5 + 4;
        }

        // Education
        const eduList = (candidateResume.education || []).filter((e) => e.degree || e.institution);
        if (eduList.length > 0) {
            renderSectionHeader("Education");
            eduList.forEach((edu) => {
                checkPageBreak(12);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(15, 23, 42);
                doc.text(edu.degree || "Degree", margin, y);

                if (edu.year) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139);
                    const yearWidth = doc.getTextWidth(edu.year);
                    doc.text(edu.year, pageWidth - margin - yearWidth, y);
                }
                y += 4.5;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                const eduLine = [edu.institution, edu.gpa ? `GPA: ${edu.gpa}` : null]
                    .filter(Boolean)
                    .join(" — ");
                doc.text(eduLine, margin, y);
                y += 6;
            });
        }

        const cleanName = candidateName.replace(/\s+/g, "_");
        doc.save(`${cleanName}_Resume.pdf`);
        setToast(`📥 Exported ${candidateName}'s Resume PDF`);
    };

    // Filter candidate resumes
    const filteredResumes = resumes.filter((r) => {
        const name = (r.personalInfo?.name || r.user?.name || "").toLowerCase();
        const email = (r.personalInfo?.email || r.user?.email || "").toLowerCase();
        const title = (r.personalInfo?.title || "").toLowerCase();
        const skills = (r.skills || []).join(" ").toLowerCase();
        const query = search.toLowerCase();

        const matchesQuery =
            name.includes(query) || email.includes(query) || title.includes(query) || skills.includes(query);

        if (!matchesQuery) return false;

        if (filterStatus === "has_experience") {
            return (r.experience || []).length > 0;
        }
        if (filterStatus === "has_projects") {
            return (r.projects || []).length > 0;
        }
        return true;
    });

    const filteredUsers = users.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const query = search.toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    if (loading) {
        return (
            <div className="admin-page">
                <div className="dashboard-loading">
                    <span className="spinner-large"></span>
                    <p>Loading Admin Intelligence Console...</p>
                </div>
            </div>
        );
    }

    const adminPictureUrl = admin?.profilePicture ? `${API_ORIGIN}${admin.profilePicture}` : null;

    return (
        <div className="admin-page">
            {/* Ambient Lighting */}
            <div className="ambient-glow glow-admin-1"></div>
            <div className="ambient-glow glow-admin-2"></div>

            {/* Studio Navigation Bar */}
            <header className="admin-nav">
                <div className="admin-nav-container">
                    <div className="dashboard-brand" onClick={() => setActiveTab("overview")}>
                        <div className="brand-logo admin-brand-logo">
                            <span>A</span>
                            <div className="ai-badge admin-ai-badge">PRO CONSOLE</div>
                        </div>
                        <div className="brand-text">
                            <h2>ResumeStudio</h2>
                            <p>Executive Admin Hub</p>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="nav-tabs">
                        <button
                            className={`nav-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                            onClick={() => setActiveTab("overview")}
                        >
                            <span className="tab-icon">📊</span>
                            <span>System Overview</span>
                        </button>
                        <button
                            className={`nav-tab-btn ${activeTab === "resumes" ? "active" : ""}`}
                            onClick={() => setActiveTab("resumes")}
                        >
                            <span className="tab-icon">👥</span>
                            <span>Candidates & Resumes</span>
                            <span className="tab-badge">{resumes.length}</span>
                        </button>
                        <button
                            className={`nav-tab-btn ${activeTab === "users" ? "active" : ""}`}
                            onClick={() => setActiveTab("users")}
                        >
                            <span className="tab-icon">👤</span>
                            <span>User Accounts</span>
                            <span className="tab-badge">{users.length}</span>
                        </button>
                    </nav>

                    {/* Right Profile & Logout */}
                    <div className="nav-actions">
                        <div className="admin-user-chip">
                            <div className="admin-avatar-sm">
                                {adminPictureUrl ? (
                                    <img src={adminPictureUrl} alt={admin?.name} />
                                ) : (
                                    admin?.name?.charAt(0).toUpperCase() || "A"
                                )}
                            </div>
                            <div className="admin-chip-info">
                                <span className="chip-name">{admin?.name || "Admin"}</span>
                                <span className="admin-pill">ADMIN</span>
                            </div>
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

            {/* Main Admin Content */}
            <main className="admin-main-content">
                {/* Global Error Banner */}
                {error && (
                    <div className="error-message">
                        <span>⚠</span>
                        <div style={{ flex: 1 }}>{error}</div>
                        <button className="error-close" onClick={() => setError("")}>✕</button>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 1: SYSTEM & EXECUTIVE OVERVIEW                            */}
                {/* ============================================================== */}
                {activeTab === "overview" && (
                    <div className="tab-content overview-tab animate-fade">
                        {/* Executive KPI Stats Grid */}
                        <div className="admin-kpi-grid">
                            <div className="kpi-card">
                                <div className="kpi-icon-box" style={{ background: "#eef2ff", color: "#4f46e5" }}>
                                    👥
                                </div>
                                <div className="kpi-details">
                                    <span className="kpi-label">Registered Candidates</span>
                                    <h3 className="kpi-value">{stats?.totalUsers ?? users.length}</h3>
                                    <span className="kpi-trend">Total talent pool</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon-box" style={{ background: "#ecfdf5", color: "#059669" }}>
                                    📄
                                </div>
                                <div className="kpi-details">
                                    <span className="kpi-label">Active Resumes</span>
                                    <h3 className="kpi-value">{stats?.totalResumes ?? resumes.length}</h3>
                                    <span className="kpi-trend">Profiles submitted</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon-box" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                                    ✨
                                </div>
                                <div className="kpi-details">
                                    <span className="kpi-label">AI Summaries Generated</span>
                                    <h3 className="kpi-value">{stats?.resumesWithSummary ?? resumes.filter((r) => r.summary).length}</h3>
                                    <span className="kpi-trend">Gemini verified</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon-box" style={{ background: "#fff7ed", color: "#ea580c" }}>
                                    📈
                                </div>
                                <div className="kpi-details">
                                    <span className="kpi-label">Profile Completion Rate</span>
                                    <h3 className="kpi-value">{stats?.completionRate ?? 0}%</h3>
                                    <span className="kpi-trend">Resume to User Ratio</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Skills Cloud & Distribution */}
                        <div className="admin-insights-grid">
                            <div className="insights-card">
                                <div className="insights-header">
                                    <div className="insights-title">
                                        <span className="card-badge-icon">⚡</span>
                                        <div>
                                            <h3>Top In-Demand Candidate Skills</h3>
                                            <p>Real-time frequency of technical capabilities across candidate pool</p>
                                        </div>
                                    </div>
                                </div>

                                {stats?.topSkills && stats.topSkills.length > 0 ? (
                                    <div className="top-skills-bars-list">
                                        {stats.topSkills.map((skill, i) => {
                                            const maxCount = stats.topSkills[0]?.count || 1;
                                            const percent = Math.round((skill.count / maxCount) * 100);
                                            return (
                                                <div key={i} className="skill-bar-row">
                                                    <div className="skill-bar-info">
                                                        <span className="skill-name">{skill.name}</span>
                                                        <span className="skill-count">{skill.count} candidates</span>
                                                    </div>
                                                    <div className="skill-bar-track">
                                                        <div
                                                            className="skill-bar-fill"
                                                            style={{
                                                                width: `${percent}%`,
                                                                background: i < 3 ? "linear-gradient(90deg, #4f46e5, #6366f1)" : "#94a3b8"
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="empty-insights">
                                        <p>No skills data recorded yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent Candidates Activity Card */}
                            <div className="insights-card">
                                <div className="insights-header">
                                    <div className="insights-title">
                                        <span className="card-badge-icon">🚀</span>
                                        <div>
                                            <h3>Recent Candidate Submissions</h3>
                                            <p>Latest talent profiles ready for review</p>
                                        </div>
                                    </div>
                                    <button className="btn-outline-sm" onClick={() => setActiveTab("resumes")}>
                                        View All ({resumes.length}) →
                                    </button>
                                </div>

                                <div className="recent-candidates-list">
                                    {resumes.slice(0, 5).map((r) => {
                                        const candidateName = r.personalInfo?.name || r.user?.name || "Unknown";
                                        const candidateEmail = r.personalInfo?.email || r.user?.email || "";
                                        const pic = r.user?.profilePicture ? `${API_ORIGIN}${r.user.profilePicture}` : null;

                                        return (
                                            <div key={r._id} className="recent-candidate-row" onClick={() => setSelectedResume(r)}>
                                                <div className="recent-avatar">
                                                    {pic ? (
                                                        <img src={pic} alt={candidateName} />
                                                    ) : (
                                                        candidateName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="recent-info">
                                                    <strong>{candidateName}</strong>
                                                    <span>{candidateEmail}</span>
                                                </div>
                                                <div className="recent-date">
                                                    {formatDate(r.createdAt)}
                                                </div>
                                                <button className="btn-table-action" onClick={(e) => { e.stopPropagation(); setSelectedResume(r); }}>
                                                    Inspect →
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {resumes.length === 0 && (
                                        <div className="empty-insights">
                                            <p>No candidate resumes submitted yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 2: CANDIDATES & RESUMES DIRECTORY                         */}
                {/* ============================================================== */}
                {activeTab === "resumes" && (
                    <div className="tab-content resumes-tab animate-fade">
                        {/* Directory Controls Bar */}
                        <div className="directory-controls-card">
                            <div className="search-box-wrapper">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search candidates by name, email, title, or skills..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="search-input-field"
                                />
                                {search && (
                                    <button className="search-clear-btn" onClick={() => setSearch("")}>✕</button>
                                )}
                            </div>

                            <div className="filters-group">
                                <div className="filter-pills">
                                    <button
                                        className={`filter-pill ${filterStatus === "all" ? "active" : ""}`}
                                        onClick={() => setFilterStatus("all")}
                                    >
                                        All Profiles ({resumes.length})
                                    </button>
                                    <button
                                        className={`filter-pill ${filterStatus === "has_experience" ? "active" : ""}`}
                                        onClick={() => setFilterStatus("has_experience")}
                                    >
                                        With Work Experience
                                    </button>
                                    <button
                                        className={`filter-pill ${filterStatus === "has_projects" ? "active" : ""}`}
                                        onClick={() => setFilterStatus("has_projects")}
                                    >
                                        With Projects
                                    </button>
                                </div>

                                <div className="view-toggle-btns">
                                    <button
                                        className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                                        onClick={() => setViewMode("grid")}
                                        title="Grid View"
                                    >
                                        ⊞ Cards
                                    </button>
                                    <button
                                        className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                                        onClick={() => setViewMode("table")}
                                        title="Table View"
                                    >
                                        ☰ Table
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Candidates Grid View */}
                        {viewMode === "grid" && (
                            <div className="candidates-grid">
                                {filteredResumes.map((r) => {
                                    const candidateName = r.personalInfo?.name || r.user?.name || "Candidate";
                                    const candidateTitle = r.personalInfo?.title || "Software Professional";
                                    const candidateEmail = r.personalInfo?.email || r.user?.email || "";
                                    const candidatePhone = r.personalInfo?.phone || r.user?.phone || "";
                                    const candidateLocation = r.personalInfo?.location || "";
                                    const pic = r.user?.profilePicture ? `${API_ORIGIN}${r.user.profilePicture}` : null;
                                    const skills = r.skills || [];

                                    return (
                                        <div key={r._id} className="candidate-card animate-fade">
                                            <div className="candidate-card-header">
                                                <div className="candidate-avatar-box">
                                                    {pic ? (
                                                        <img src={pic} alt={candidateName} />
                                                    ) : (
                                                        candidateName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="candidate-main-info">
                                                    <h3>{candidateName}</h3>
                                                    <span className="candidate-title">{candidateTitle}</span>
                                                    <span className="candidate-date">Submitted {formatDate(r.createdAt)}</span>
                                                </div>
                                            </div>

                                            <div className="candidate-contact-tags">
                                                {candidateEmail && <span className="contact-tag">📧 {candidateEmail}</span>}
                                                {candidatePhone && <span className="contact-tag">📱 {candidatePhone}</span>}
                                                {candidateLocation && <span className="contact-tag">📍 {candidateLocation}</span>}
                                            </div>

                                            {/* AI Summary snippet */}
                                            {r.summary && (
                                                <div className="candidate-summary-snippet">
                                                    <div className="snippet-ai-badge">✨ Gemini AI Brief</div>
                                                    <p>"{r.summary.length > 140 ? r.summary.slice(0, 140) + "..." : r.summary}"</p>
                                                </div>
                                            )}

                                            {/* Skills Tags */}
                                            {skills.length > 0 && (
                                                <div className="candidate-skills-flow">
                                                    {skills.slice(0, 4).map((s, i) => (
                                                        <span key={i} className="candidate-skill-pill">{s}</span>
                                                    ))}
                                                    {skills.length > 4 && (
                                                        <span className="candidate-skill-more">+{skills.length - 4} more</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer Actions */}
                                            <div className="candidate-card-footer">
                                                <button
                                                    className="btn-primary-sm"
                                                    onClick={() => setSelectedResume(r)}
                                                >
                                                    Inspect Profile →
                                                </button>
                                                <button
                                                    className="btn-outline-sm"
                                                    onClick={() => downloadCandidatePdf(r)}
                                                    title="Export PDF"
                                                >
                                                    📄 PDF
                                                </button>
                                                <button
                                                    className="btn-danger-icon"
                                                    onClick={() => setResumeToDelete(r)}
                                                    title="Delete Resume"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredResumes.length === 0 && (
                                    <div className="empty-state-box full-width">
                                        <div className="empty-icon">📭</div>
                                        <h3>No Candidate Resumes Found</h3>
                                        <p>Try adjusting your search criteria or filter tags.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Candidates Table View */}
                        {viewMode === "table" && (
                            <div className="table-container-card">
                                <table className="admin-data-table">
                                    <thead>
                                        <tr>
                                            <th>Candidate</th>
                                            <th>Contact</th>
                                            <th>Key Skills</th>
                                            <th>Experience</th>
                                            <th>Submitted</th>
                                            <th style={{ textAlign: "right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResumes.map((r) => {
                                            const candidateName = r.personalInfo?.name || r.user?.name || "Candidate";
                                            const candidateEmail = r.personalInfo?.email || r.user?.email || "";
                                            const pic = r.user?.profilePicture ? `${API_ORIGIN}${r.user.profilePicture}` : null;
                                            const skills = r.skills || [];

                                            return (
                                                <tr key={r._id} onClick={() => setSelectedResume(r)} className="table-clickable-row">
                                                    <td>
                                                        <div className="table-user-cell">
                                                            <div className="table-avatar">
                                                                {pic ? <img src={pic} alt={candidateName} /> : candidateName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <strong>{candidateName}</strong>
                                                                <span className="table-sub">{r.personalInfo?.title || "Candidate"}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="table-contact-cell">
                                                            <span>{candidateEmail}</span>
                                                            <span className="table-sub">{r.personalInfo?.phone || "No phone"}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="table-skills-cell">
                                                            {skills.slice(0, 3).map((s, i) => (
                                                                <span key={i} className="candidate-skill-pill">{s}</span>
                                                            ))}
                                                            {skills.length > 3 && <span className="candidate-skill-more">+{skills.length - 3}</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="count-badge">{(r.experience || []).length} roles</span>
                                                    </td>
                                                    <td>
                                                        <span className="date-cell">{formatDate(r.createdAt)}</span>
                                                    </td>
                                                    <td>
                                                        <div className="table-actions-cell" onClick={(e) => e.stopPropagation()}>
                                                            <button className="btn-table-action" onClick={() => setSelectedResume(r)}>
                                                                View
                                                            </button>
                                                            <button className="btn-table-action" onClick={() => downloadCandidatePdf(r)}>
                                                                PDF
                                                            </button>
                                                            <button className="btn-danger-icon" onClick={() => setResumeToDelete(r)}>
                                                                🗑
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredResumes.length === 0 && (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: "center", padding: "40px" }}>
                                                    No candidate records match your search.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: USER ACCOUNTS MANAGEMENT                               */}
                {/* ============================================================== */}
                {activeTab === "users" && (
                    <div className="tab-content users-tab animate-fade">
                        <div className="directory-controls-card">
                            <div className="search-box-wrapper">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Search registered user accounts..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="search-input-field"
                                />
                            </div>
                            <div className="users-count-badge">
                                Total Accounts: <strong>{users.length}</strong>
                            </div>
                        </div>

                        <div className="table-container-card">
                            <table className="admin-data-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Resume Status</th>
                                        <th>Phone / Bio</th>
                                        <th>Joined Date</th>
                                        <th style={{ textAlign: "right" }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u) => {
                                        const pic = u.profilePicture ? `${API_ORIGIN}${u.profilePicture}` : null;
                                        return (
                                            <tr key={u._id}>
                                                <td>
                                                    <div className="table-user-cell">
                                                        <div className="table-avatar">
                                                            {pic ? <img src={pic} alt={u.name} /> : u.name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <strong>{u.name}</strong>
                                                            <span className="table-sub">{u.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`role-pill ${u.role === "admin" ? "admin-pill" : "user-pill"}`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    {u.hasResume ? (
                                                        <span className="status-pill active-status">✓ Submitted Resume</span>
                                                    ) : (
                                                        <span className="status-pill pending-status">○ Incomplete</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="table-sub">{u.phone || u.bio || "—"}</span>
                                                </td>
                                                <td>
                                                    <span className="date-cell">{formatDate(u.createdAt)}</span>
                                                </td>
                                                <td>
                                                    <div className="table-actions-cell">
                                                        {u.role !== "admin" && (
                                                            <button
                                                                className="btn-danger-icon"
                                                                onClick={() => setUserToDelete(u)}
                                                                title="Delete User Account"
                                                            >
                                                                🗑 Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* ============================================================== */}
            {/* FULL CANDIDATE PROFILE INSPECTION DRAWER / MODAL               */}
            {/* ============================================================== */}
            {selectedResume && (
                <div className="modal-overlay" onClick={() => setSelectedResume(null)}>
                    <div className="candidate-drawer-modal animate-pop" onClick={(e) => e.stopPropagation()}>
                        {/* Drawer Header */}
                        <div className="drawer-header">
                            <div className="drawer-header-left">
                                <div className="drawer-avatar">
                                    {selectedResume.user?.profilePicture ? (
                                        <img
                                            src={`${API_ORIGIN}${selectedResume.user.profilePicture}`}
                                            alt={selectedResume.personalInfo?.name || selectedResume.user?.name}
                                        />
                                    ) : (
                                        (selectedResume.personalInfo?.name || selectedResume.user?.name || "C").charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="drawer-candidate-meta">
                                    <h2>{selectedResume.personalInfo?.name || selectedResume.user?.name}</h2>
                                    <p className="drawer-title">{selectedResume.personalInfo?.title || "Candidate Profile"}</p>
                                    <div className="drawer-contact-line">
                                        <span>📧 {selectedResume.personalInfo?.email || selectedResume.user?.email}</span>
                                        {selectedResume.personalInfo?.phone && (
                                            <span>📱 {selectedResume.personalInfo.phone}</span>
                                        )}
                                        {selectedResume.personalInfo?.location && (
                                            <span>📍 {selectedResume.personalInfo.location}</span>
                                        )}
                                    </div>
                                    <div className="drawer-links-line">
                                        {selectedResume.personalInfo?.linkedin && (
                                            <a href={`https://${selectedResume.personalInfo.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                                                LinkedIn ↗
                                            </a>
                                        )}
                                        {selectedResume.personalInfo?.github && (
                                            <a href={`https://${selectedResume.personalInfo.github.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                                                GitHub ↗
                                            </a>
                                        )}
                                        {selectedResume.personalInfo?.website && (
                                            <a href={selectedResume.personalInfo.website} target="_blank" rel="noreferrer">
                                                Portfolio ↗
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="drawer-header-actions">
                                <button className="btn-primary-sm" onClick={() => downloadCandidatePdf(selectedResume)}>
                                    📄 Export Full PDF
                                </button>
                                <button
                                    className="btn-danger-icon"
                                    onClick={() => setResumeToDelete(selectedResume)}
                                    title="Delete Resume"
                                >
                                    🗑
                                </button>
                                <button className="drawer-close-btn" onClick={() => setSelectedResume(null)}>
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Drawer Scrollable Content */}
                        <div className="drawer-body">
                            {/* Gemini AI Recruiter Briefing */}
                            {selectedResume.summary && (
                                <div className="drawer-section ai-summary-box">
                                    <div className="section-badge-bar">
                                        <span>✨ Gemini AI Recruiter Briefing</span>
                                        <button
                                            className="copy-btn-sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedResume.summary);
                                                setToast("📋 AI summary copied to clipboard!");
                                            }}
                                        >
                                            Copy Summary
                                        </button>
                                    </div>
                                    <p className="ai-briefing-text">"{selectedResume.summary}"</p>
                                </div>
                            )}

                            {/* Skills Tag Section */}
                            {(selectedResume.skills || []).length > 0 && (
                                <div className="drawer-section">
                                    <h4 className="drawer-section-title">⚡ Skills & Technologies</h4>
                                    <div className="drawer-skills-flow">
                                        {selectedResume.skills.map((s, i) => (
                                            <span key={i} className="candidate-skill-pill">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Work Experience */}
                            {(selectedResume.experience || []).length > 0 && (
                                <div className="drawer-section">
                                    <h4 className="drawer-section-title">💼 Work Experience</h4>
                                    <div className="timeline-items-list">
                                        {selectedResume.experience.map((exp, i) => (
                                            <div key={i} className="drawer-timeline-item">
                                                <div className="timeline-header">
                                                    <strong>{exp.role || "Role"}</strong>
                                                    <span className="timeline-date">{exp.duration}</span>
                                                </div>
                                                <span className="timeline-company">{exp.company} {exp.location && `• ${exp.location}`}</span>
                                                <p className="timeline-desc">{exp.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Projects */}
                            {(selectedResume.projects || []).length > 0 && (
                                <div className="drawer-section">
                                    <h4 className="drawer-section-title">🚀 Key Projects</h4>
                                    <div className="drawer-projects-grid">
                                        {selectedResume.projects.map((proj, i) => (
                                            <div key={i} className="drawer-project-card">
                                                <div className="proj-header">
                                                    <strong>{proj.title || "Project"}</strong>
                                                    {proj.techStack && <span className="proj-stack">{proj.techStack}</span>}
                                                </div>
                                                <p className="proj-desc">{proj.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Education */}
                            {(selectedResume.education || []).length > 0 && (
                                <div className="drawer-section">
                                    <h4 className="drawer-section-title">🎓 Education</h4>
                                    <div className="drawer-edu-grid">
                                        {selectedResume.education.map((edu, i) => (
                                            <div key={i} className="drawer-edu-card">
                                                <strong>{edu.degree || "Degree"}</strong>
                                                <p>{edu.institution}</p>
                                                <span>{edu.year} {edu.gpa && `• GPA: ${edu.gpa}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Certifications & Awards */}
                            {((selectedResume.certifications || []).length > 0 || (selectedResume.awards || []).length > 0) && (
                                <div className="drawer-section">
                                    <h4 className="drawer-section-title">🏆 Certifications & Awards</h4>
                                    {selectedResume.certifications?.length > 0 && (
                                        <p><strong>Certs:</strong> {selectedResume.certifications.join(", ")}</p>
                                    )}
                                    {selectedResume.awards?.length > 0 && (
                                        <p><strong>Honors:</strong> {selectedResume.awards.join(", ")}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resume Delete Confirmation Modal */}
            {resumeToDelete && (
                <div className="modal-overlay" onClick={() => !deleting && setResumeToDelete(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Candidate Resume?</h3>
                        <p>
                            This will remove the resume and AI summary for{" "}
                            <strong>{resumeToDelete.personalInfo?.name || resumeToDelete.user?.name || "this candidate"}</strong>.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setResumeToDelete(null)} disabled={deleting}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={handleConfirmDeleteResume} disabled={deleting}>
                                {deleting ? "Deleting..." : "Delete Resume"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Delete Confirmation Modal */}
            {userToDelete && (
                <div className="modal-overlay" onClick={() => !deleting && setUserToDelete(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete User Account?</h3>
                        <p>
                            Are you sure you want to permanently delete user <strong>{userToDelete.name}</strong> ({userToDelete.email})?
                            This will also delete their resume data.
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setUserToDelete(null)} disabled={deleting}>
                                Cancel
                            </button>
                            <button className="btn-danger" onClick={handleConfirmDeleteUser} disabled={deleting}>
                                {deleting ? "Deleting..." : "Delete User Account"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Toast Notification */}
            {toast && <div className="toast animate-toast">{toast}</div>}
        </div>
    );
}

export default AdminDashboard;