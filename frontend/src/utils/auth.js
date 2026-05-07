const AUTH_KEY = "medicomates_user";
const USERS_KEY = "medicomates_users";

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readUsers = () => safeParse(localStorage.getItem(USERS_KEY), []);

const writeUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const toSessionUser = (user) => ({
  id: user.id,
  name: user.full_name,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
});

export const registerUser = ({ full_name, email, password, role = "patient" }) => {
  const users = readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = users.find((user) => user.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error("Email already registered");
  }

  const newUser = {
    id: `user_${Date.now()}`,
    full_name: full_name.trim(),
    email: normalizedEmail,
    password,
    role,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);
  return toSessionUser(newUser);
};

export const login = (email, password) => {
  const users = readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find(
    (entry) => entry.email.toLowerCase() === normalizedEmail && entry.password === password
  );

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const sessionUser = toSessionUser(user);
  localStorage.setItem(AUTH_KEY, JSON.stringify(sessionUser));
  return sessionUser;
};

export const logout = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const getCurrentUser = () => safeParse(localStorage.getItem(AUTH_KEY), null);
