import api from "./services/api";

export const chatWithAI = async (message, history) => {
    const response = await api.post("/ai/chat", { message, history });
    return response.data;
};

export const improveResumeSummary = async (summary) => {
    const response = await api.post("/ai/improve-summary", { summary });
    return response.data;
};

export const improveResumeProject = async (title, description) => {
    const response = await api.post("/ai/improve-project", { title, description });
    return response.data;
};
