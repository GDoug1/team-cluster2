import { useEffect, useState } from "react";
import { fetchMyProfile, saveMyProfile } from "../api/profile";
import { useFeedback } from "./FeedbackContext";

const initialProfileForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  address: "",
  email: "",
  personal_email: "",
  birthdate: "",
  civil_status: "",
  current_password: "",
  new_password: "",
  confirm_new_password: ""
};

const civilStatusOptions = [
  "Single",
  "Married",
  "Separated",
  "Divorced",
  "Widowed"
];

export default function ProfileSection() {
  const { showToast } = useFeedback();
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");

      try {
        const profile = await fetchMyProfile();
        if (!isMounted) return;
        setProfileForm({
          first_name: profile?.first_name ?? "",
          middle_name: profile?.middle_name ?? "",
          last_name: profile?.last_name ?? "",
          address: profile?.address ?? "",
          email: profile?.email ?? "",
          personal_email: profile?.personal_email ?? "",
          birthdate: profile?.birthdate ?? "",
          civil_status: profile?.civil_status ?? "",
          current_password: "",
          new_password: "",
          confirm_new_password: ""
        });
      } catch (error) {
        if (!isMounted) return;
        setProfileError(error?.error ?? "Unable to load your profile.");
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleProfileChange = event => {
    const { name, value } = event.target;
    setProfileForm(current => ({
      ...current,
      [name]: value
    }));
  };

  const handleProfileSave = async event => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError("");

    try {
      const profile = await saveMyProfile(profileForm);
      setProfileForm({
        first_name: profile?.first_name ?? "",
        middle_name: profile?.middle_name ?? "",
        last_name: profile?.last_name ?? "",
        address: profile?.address ?? "",
        email: profile?.email ?? "",
        personal_email: profile?.personal_email ?? "",
        birthdate: profile?.birthdate ?? "",
        civil_status: profile?.civil_status ?? "",
        current_password: "",
        new_password: "",
        confirm_new_password: ""
      });
      window.dispatchEvent(new Event("current-user-updated"));
      showToast({
        title: "Profile updated",
        message: "Your profile details were saved successfully.",
        type: "success"
      });
    } catch (error) {
      const message = error?.error ?? "Unable to save your profile.";
      setProfileError(message);
      showToast({
        title: "Save failed",
        message,
        type: "error"
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (profileLoading) {
    return (
      <section className="content">
        <div className="empty-state">Loading your profile...</div>
      </section>
    );
  }

  return (
    <section className="content">
      <div className="profile-shell">
        <div className="profile-header">
          <h2>My Profile</h2>
          <p>Update your personal and contact details here.</p>
        </div>

        <form className="profile-form" onSubmit={handleProfileSave}>
          <div className="profile-grid">
            <label className="profile-field">
              <span>First Name</span>
              <input name="first_name" value={profileForm.first_name} onChange={handleProfileChange} required />
            </label>
            <label className="profile-field">
              <span>Middle Name</span>
              <input name="middle_name" value={profileForm.middle_name} onChange={handleProfileChange} />
            </label>
            <label className="profile-field">
              <span>Last Name</span>
              <input name="last_name" value={profileForm.last_name} onChange={handleProfileChange} required />
            </label>
            <label className="profile-field profile-field-wide">
              <span>Address</span>
              <input name="address" value={profileForm.address} onChange={handleProfileChange} />
            </label>
            <label className="profile-field">
              <span>Work Email</span>
              <input type="email" name="email" value={profileForm.email} onChange={handleProfileChange} required />
            </label>
            <label className="profile-field">
              <span>Personal Email</span>
              <input type="email" name="personal_email" value={profileForm.personal_email} onChange={handleProfileChange} />
            </label>
            <label className="profile-field">
              <span>Birthdate</span>
              <input type="date" name="birthdate" value={profileForm.birthdate} onChange={handleProfileChange} />
            </label>
            <label className="profile-field">
              <span>Civil Status</span>
              <select name="civil_status" value={profileForm.civil_status} onChange={handleProfileChange}>
                <option value="">Select civil status</option>
                {civilStatusOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              <span>Current Password</span>
              <input type="password" name="current_password" value={profileForm.current_password} onChange={handleProfileChange} placeholder="Enter current password" />
            </label>
            <label className="profile-field">
              <span>New Password</span>
              <input type="password" name="new_password" value={profileForm.new_password} onChange={handleProfileChange} placeholder="Enter new password" />
            </label>
            <label className="profile-field">
              <span>Confirm Password</span>
              <input type="password" name="confirm_new_password" value={profileForm.confirm_new_password} onChange={handleProfileChange} placeholder="Confirm new password" />
            </label>
          </div>

          {profileError ? <p className="team-empty-note">{profileError}</p> : null}

          <div className="profile-actions">
            <button className="btn primary" type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
