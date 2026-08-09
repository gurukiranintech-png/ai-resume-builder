import api from "./api";

export const loginUser = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
};

export const registerUser = async (formData) => {
    const { data } = await api.post("/auth/register", formData);
    return data;
};