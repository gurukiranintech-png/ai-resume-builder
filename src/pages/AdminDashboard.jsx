import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllResumes, deleteResume } from "../services/adminService";
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedResume, setSelectedResume] = useState(null);
    const [search, setSearch] = useState("");
    const [resumeToDelete, setResumeToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!token || !storedUser) {
            navigate("/login");
            return;
        }

        const parsedUser = JSON.parse(storedUser);

        if (parsedUser.role !== "admin") {
            navigate("/dashboard");
            return;
        }

        setAdmin(parsedUser);
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const data = await getAllResumes();
            if (data.success) {
                setResumes(data.resumes);
            }
        } catch (error) {
            console.error("Failed to fetch resumes:", error);
            setError(error.response?.data?.message || "Failed to load resumes");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const handleConfirmDelete = async () => {
        if (!resumeToDelete) return;

        setDeleting(true);
        try {
            await deleteResume(resumeToDelete._id);
            setResumes((prev) => prev.filter((r) => r._id !== resumeToDelete._id));

            if (selectedResume?._id === resumeToDelete._id) {
                setSelectedResume(null);
            }
            setResumeToDelete(null);
        } catch (error) {
            console.error("Failed to delete resume:", error);
            setError(error.response?.data?.message || "Failed to delete resume");
        } finally {
            setDeleting(false);
        }
    };

    const downloadSummaryAsPdf = (resume) => {
        const doc = new jsPDF();
        const marginX = 15;
        let y = 20;

        doc.setFontSize(16);
        doc.text(resume.user?.name || "Candidate", marginX, y);
        y += 8;

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(resume.user?.email || "", marginX, y);
        y += 6;
        doc.text(`Submitted: ${formatDate(resume.createdAt)}`, marginX, y);
        y += 12;

        doc.setTextColor(0);
        doc.setFontSize(13);
        doc.text("AI Summary", marginX, y);
        y += 8;

        doc.setFontSize(11);
        const lines = doc.splitTextToSize(resume.summary || "No summary available.", 180);
        doc.text(lines, marginX, y);

        doc.save(`${(resume.user?.name || "candidate").replace(/\s+/g, "_")}_summary.pdf`);
    };

    const filteredResumes = resumes.filter((r) => {
        const name = r.user?.name?.toLowerCase() || "";
        const email = r.user?.email?.toLowerCase() || "";
        const query = search.toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    if (loading) {
        return (
            <div className="admin-page">
                <div className="dashboard-loading">Loading...</div>
            </div>
        );
    }

    const adminPictureUrl = admin?.profilePicture ? `${API_ORIGIN}${admin.profilePicture}` : null;

    return (
        <div className="admin-page">
            <div className="background-circle circle-one"></div>
            <div className="background-circle circle-two"></div>

            <div className="admin-container">

                {/* Top bar */}
                <div className="dashboard-topbar">
                    <div className="dashboard-brand">
                        <div className="brand-logo">
                            <span>R</span>
                            <div className="ai-badge">AI</div>
                        </div>
                        <div>
                            <h1>AI Resume Builder</h1>
                            <p>Admin Dashboard</p>
                        </div>
                    </div>

                    <button className="logout-button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>

                {/* Admin profile */}
                {admin && (
                    <div className="profile-card">
                        <div
                            className="profile-avatar admin-avatar"
                            style={adminPictureUrl ? { padding: 0, overflow: "hidden" } : undefined}
                        >
                            {adminPictureUrl ? (
                                <img
                                    src={adminPictureUrl}
                                    alt={admin.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                />
                            ) : (
                                admin.name?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h2>{admin.name}</h2>
                            <p>{admin.email}</p>
                            {admin.bio && <p style={{ margin: "2px 0 6px" }}>{admin.bio}</p>}
                            <span className="role-badge admin-badge">admin</span>
                        </div>
                        <div className="stat-block">
                            <span className="stat-number">{resumes.length}</span>
                            <span className="stat-label">Resumes Submitted</span>
                        </div>
                    </div>
                )}

                {error && <div className="error-message"><span>⚠</span>{error}</div>}

                {/* Resume list */}
                <div className="admin-list-card">
                    <div className="admin-list-header">
                        <h2>Submitted Resumes</h2>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {filteredResumes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>No resumes found.</p>
                        </div>
                    ) : (
                        <div className="resume-list">
                            {filteredResumes.map((resume) => {
                                const rowPictureUrl = resume.user?.profilePicture
                                    ? `${API_ORIGIN}${resume.user.profilePicture}`
                                    : null;

                                return (
                                    <div className="resume-row" key={resume._id}>
                                        <div
                                            className="resume-row-avatar"
                                            style={rowPictureUrl ? { padding: 0, overflow: "hidden" } : undefined}
                                        >
                                            {rowPictureUrl ? (
                                                <img
                                                    src={rowPictureUrl}
                                                    alt={resume.user?.name}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                                />
                                            ) : (
                                                resume.user?.name?.charAt(0).toUpperCase() || "?"
                                            )}
                                        </div>

                                        <div className="resume-row-info">
                                            <strong>{resume.user?.name || "Unknown"}</strong>
                                            <span>{resume.user?.email}</span>
                                        </div>

                                        <div className="resume-row-meta">
                                            <span className="file-date">
                                                {formatDate(resume.createdAt)}
                                            </span>
                                        </div>

                                        <div className="resume-row-actions">
                                            <button
                                                className="view-button"
                                                onClick={() => setSelectedResume(resume)}
                                            >
                                                View →
                                            </button>
                                            <button
                                                className="delete-button"
                                                title="Delete resume"
                                                aria-label="Delete resume"
                                                onClick={() => setResumeToDelete(resume)}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail modal — summary only */}
            {selectedResume && (
                <div className="modal-overlay" onClick={() => setSelectedResume(null)}>
                    <div className="detail-modal" onClick={(e) => e.stopPropagation()}>

                        <div className="detail-modal-header">
                            {selectedResume.user?.profilePicture && (
                                <img
                                    src={`${API_ORIGIN}${selectedResume.user.profilePicture}`}
                                    alt={selectedResume.user?.name}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        marginRight: "12px",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            <div>
                                <h2>{selectedResume.user?.name}</h2>
                                <p>{selectedResume.user?.email}</p>
                                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#888" }}>
                                    Submitted {formatDate(selectedResume.createdAt)}
                                </p>
                            </div>
                            <div className="detail-modal-header-actions">
                                <button
                                    className="delete-button"
                                    title="Delete resume"
                                    aria-label="Delete resume"
                                    onClick={() => setResumeToDelete(selectedResume)}
                                >
                                    🗑
                                </button>
                                <button
                                    className="close-button"
                                    onClick={() => setSelectedResume(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="detail-modal-body">
                            <div className="resume-section summary-highlight">
                                <h3>AI Summary</h3>
                                <p>{selectedResume.summary || "No summary available."}</p>
                            </div>

                            <div style={{ marginTop: "16px" }}>
                                <button
                                    className="upload-link"
                                    onClick={() => downloadSummaryAsPdf(selectedResume)}
                                >
                                    Download Summary as PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {resumeToDelete && (
                <div className="confirm-overlay" onClick={() => !deleting && setResumeToDelete(null)}>
                    <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete this resume?</h3>
                        <p>
                            This will permanently remove{" "}
                            <strong>{resumeToDelete.user?.name || "this"}</strong>'s submitted
                            information. This action can't be undone.
                        </p>
                        <div className="confirm-dialog-actions">
                            <button
                                className="confirm-cancel"
                                onClick={() => setResumeToDelete(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-delete"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;