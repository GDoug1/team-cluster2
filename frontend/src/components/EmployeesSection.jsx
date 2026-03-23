import { useCallback, useEffect, useState } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { apiFetch } from "../api/api";
import { useFeedback } from "./FeedbackContext";
import usePermissions from "../hooks/usePermissions";

const initialEmployeeForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  address: "",
  birthdate: "",
  contact_number: "",
  civil_status: "",
  personal_email: "",
  work_email: "",
  position: "",
  account: "",
  employee_type: "",
  employment_status: "Active",
  date_hired: ""
};

const employmentPositions = [
  "President",
  "HR Lead",
  "Service Delivery Manager",
  "HR Coordinator",
  "IT Administrator",
  "Administrative Support",
  "Accounting",
  "Accounting Associate",
  "Sr. Recruitment Specialist",
  "Jr. Recruitment Specialist",
  "Head of Training",
  "Tier 1 Technical Support",
  "Tier 2 Technical Support",
  "Tier 3 Technical Support",
  "NOC Tier 1 Support",
  "NOC Tier 2 Support",
  "NOC Tier 3 Support",
  "SIP NOC Support Engineer",
  "VOIP Support Technician 1",
  "VOIP Support Technician 2",
  "Help Desk Support 1",
  "Help Desk Support 2",
  "Junior Support Engineer",
  "Software QA Engineer",
  "Project Coordinator",
  "Pre Sales Support",
  "LNP Specialist",
  "Carrier Specialist",
  "Order Manager",
  "Customer Support Representative",
  "Billing Coordinator",
  "PHP Developer",
  "Full Stack Developer",
  "JAVA Developer",
  "Technical Support Engineer",
  "Graphic Designer",
  "Bookkeeper",
  "Technical Trainer",
  "Junior IT Technician"
];

const employmentAccounts = [
  "iReply Back Office Services",
  "In-Telecom Consulting",
  "SIPPIO",
  "Teammate Technology LLC",
  "Viirtue LLC",
  "RingLogix Technologies",
  "RabbitRun",
  "Telco Experts",
  "Crexendo",
  "Advanced Network Solutions",
  "NUSO",
  "Sourcetoad",
  "ATL Communications",
  "Total CX",
  "Element IQ",
  "Telepath",
  "Vitale ENT",
  "Cloud Service Networks",
  "Business VOIP",
  "Rotolo - Bravo 1",
  "Advanced Data Infrastructure",
  "Rotolo - Oxfresh",
  "Level1 - YDC",
  "VoxRush",
  "Clarity Voice",
  "Spectrum VOIP",
  "Rotolo",
  "test client",
  "VoIP CX",
  "VOIP.MS",
  "Rotolo - Rainbow Restoration",
  "UnitedCloud Inc.",
  "Sonicetel",
  "YD Level 1",
  "Palmers Relocations",
  "Atheral",
  "Numhub",
  "Internship",
  "Advanced Network Services",
  "Rotolo (Valet Waste)",
  "Recent Communication",
  "Kevlar IT Solutions",
  "Smart Choice"
];

const employeeTypes = ["Regular", "Probationary", "Contractual", "Intern"];
const employeeNameFields = new Set(["first_name", "middle_name", "last_name"]);
const employeePersonalRequiredFields = [
  "first_name",
  "last_name",
  "address",
  "birthdate",
  "contact_number",
  "civil_status",
  "personal_email",
  "work_email"
];
const employeeEmploymentRequiredFields = ["position", "account", "employee_type"];
const employeeFieldLabels = {
  first_name: "First name",
  last_name: "Last name",
  address: "Address",
  birthdate: "Birthdate",
  contact_number: "Contact number",
  civil_status: "Civil status",
  personal_email: "Personal email",
  work_email: "Work email",
  position: "Position",
  account: "Account",
  employee_type: "Employee type"
};
const hasDigitPattern = /\d/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sanitizeEmployeeName = value => value.replace(/\d+/g, "");

const formatDate = dateString => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const mapEmployeeToForm = employee => ({
  first_name: employee?.first_name ?? "",
  middle_name: employee?.middle_name ?? "",
  last_name: employee?.last_name ?? "",
  address: employee?.address ?? "",
  birthdate: employee?.birthdate ?? "",
  contact_number: employee?.contact_number ?? "",
  civil_status: employee?.civil_status ?? "",
  personal_email: employee?.personal_email ?? "",
  work_email: employee?.email ?? "",
  position: employee?.position ?? "",
  account: employee?.account ?? "",
  employee_type: employee?.employee_type ?? "",
  employment_status: employee?.employment_status || "Active",
  date_hired: employee?.date_hired ?? ""
});

const getMissingEmployeeFields = (form, fields) =>
  fields.filter(field => String(form?.[field] ?? "").trim() === "");

const buildEmployeeSectionValidationMessage = (sectionLabel, missingFields) =>
  `Please complete the ${sectionLabel} fields: ${missingFields.map(field => employeeFieldLabels[field]).join(", ")}.`;

const validateEmployeePersonalSection = form => {
  const missingFields = getMissingEmployeeFields(form, employeePersonalRequiredFields);
  if (missingFields.length > 0) {
    return buildEmployeeSectionValidationMessage("Personal Information", missingFields);
  }

  const contactNumber = String(form?.contact_number ?? "").trim();
  if (!/^09\d{9}$/.test(contactNumber)) {
    return "Contact number must start with 09 and be exactly 11 digits.";
  }

  const personalEmail = String(form?.personal_email ?? "").trim();
  if (!emailPattern.test(personalEmail)) {
    return "Personal email must be a valid email address.";
  }

  const workEmail = String(form?.work_email ?? "").trim();
  if (!emailPattern.test(workEmail)) {
    return "Work email must be a valid email address.";
  }

  return "";
};

const validateEmployeeEmploymentSection = form => {
  const missingFields = getMissingEmployeeFields(form, employeeEmploymentRequiredFields);
  if (missingFields.length > 0) {
    return buildEmployeeSectionValidationMessage("Employment Details", missingFields);
  }

  return "";
};

const employeeTableColumns = [
  { key: "id", label: "ID", sortable: true },
  { key: "fullname", label: "Name", sortable: true },
  { key: "position", label: "Position", sortable: true },
  { key: "account", label: "Account", sortable: true },
  { key: "employee_type", label: "Type", sortable: true },
  { key: "employment_status", label: "Status", sortable: true },
  { key: "date_hired", label: "Hired", sortable: true },
  { key: "info", label: "Info", sortable: false },
  { key: "actions", label: "Actions", sortable: false, className: "employee-actions-cell" }
];

const getEmployeeSortValue = (employee, sortKey) => {
  if (sortKey === "id") return Number(employee?.id ?? 0);

  if (sortKey === "date_hired") {
    const timestamp = new Date(employee?.date_hired ?? "").getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  return String(employee?.[sortKey] ?? "").trim().toLowerCase();
};

const compareEmployeeValues = (leftValue, rightValue, direction) => {
  const multiplier = direction === "asc" ? 1 : -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * multiplier;
  }

  return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" }) * multiplier;
};

export default function EmployeesSection() {
  const { hasPermission } = usePermissions();
  const { confirm, showMessage, showToast } = useFeedback();
  const canViewEmployeeList = hasPermission("View Employee List");
  const canAddEmployee = hasPermission("Add Employee");
  const canEditEmployee = hasPermission("Edit Employee");
  const canDeleteEmployee = hasPermission("Delete Employee");

  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState("");
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [employeeSortKey, setEmployeeSortKey] = useState("id");
  const [employeeSortDirection, setEmployeeSortDirection] = useState("desc");
  const [employeeRowsPerPageInput, setEmployeeRowsPerPageInput] = useState("10");
  const [employeeCurrentPage, setEmployeeCurrentPage] = useState(1);

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState("");
  const [addEmployeeActiveTab, setAddEmployeeActiveTab] = useState("personal");
  const [addEmployeeForm, setAddEmployeeForm] = useState(initialEmployeeForm);

  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [isSavingEditEmployee, setIsSavingEditEmployee] = useState(false);
  const [editEmployeeError, setEditEmployeeError] = useState("");
  const [editEmployeeActiveTab, setEditEmployeeActiveTab] = useState("personal");
  const [editEmployeeForm, setEditEmployeeForm] = useState(initialEmployeeForm);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);

 // Info modal states 
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const handleOpenInfoModal = employee => {
    setSelectedEmployee(employee);
    setIsInfoModalOpen(true);
  };

  const handleCloseInfoModal = () => {
    setSelectedEmployee(null);
    setIsInfoModalOpen(false);
  };

  const fetchEmployees = useCallback(async () => {
    if (!canViewEmployeeList) {
      setEmployees([]);
      setEmployeeError("");
      setEmployeeLoading(false);
      return;
    }

    setEmployeeLoading(true);
    setEmployeeError("");
    try {
      const data = await apiFetch("api/admin/employee_management.php");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      setEmployees([]);
      setEmployeeError(error?.error ?? "Unable to load employees.");
    } finally {
      setEmployeeLoading(false);
    }
  }, [canViewEmployeeList]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    setEmployeeCurrentPage(1);
  }, [employeeSearchTerm, employeeRowsPerPageInput]);

  const handleEmployeeNameKeyDown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length === 1 && hasDigitPattern.test(event.key)) {
      event.preventDefault();
    }
  };

  const handleEmployeeSort = sortKey => {
    if (employeeSortKey === sortKey) {
      setEmployeeSortDirection(current => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setEmployeeSortKey(sortKey);
    setEmployeeSortDirection(sortKey === "id" || sortKey === "date_hired" ? "desc" : "asc");
  };

  const handleEmployeeRowsPerPageChange = event => {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setEmployeeRowsPerPageInput(digitsOnly);
  };

  const handleEmployeeRowsPerPageBlur = () => {
    const parsedValue = Number.parseInt(employeeRowsPerPageInput, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      setEmployeeRowsPerPageInput("10");
      return;
    }

    setEmployeeRowsPerPageInput(String(parsedValue));
  };

  const handleAddEmployeeChange = event => {
    const { name, value } = event.target;

    if (employeeNameFields.has(name)) {
      setAddEmployeeForm(current => ({
        ...current,
        [name]: sanitizeEmployeeName(value)
      }));
      return;
    }

    if (name === "contact_number") {
      let cleaned = value.replace(/\D/g, ""); // remove non-numbers

      // limit to 11 digits
      cleaned = cleaned.slice(0, 11);

      setAddEmployeeForm(current => ({
        ...current,
        [name]: cleaned
      }));
      return;
    }

    setAddEmployeeForm(current => ({ ...current, [name]: value }));
  };

  const handleOpenAddEmployeeModal = async () => {
    if (!canAddEmployee) return;

    const shouldOpen = await confirm({
      title: "Add employee?",
      message: "Open the add employee form?",
      confirmLabel: "Yes"
    });
    if (!shouldOpen) return;

    setAddEmployeeActiveTab("personal");
    setAddEmployeeError("");
    setAddEmployeeForm(initialEmployeeForm);
    setIsAddingEmployee(false);
    setIsAddEmployeeModalOpen(true);
  };

  const handleAddEmployeeTabChange = nextTab => {
    if (nextTab === addEmployeeActiveTab) return;

    if (nextTab === "employment" || nextTab === "benefits") {
      const personalValidationMessage = validateEmployeePersonalSection(addEmployeeForm);
      if (personalValidationMessage) {
        setAddEmployeeError(personalValidationMessage);
        setAddEmployeeActiveTab("personal");
        return;
      }
    }

    if ((addEmployeeActiveTab === "employment" && nextTab !== "employment") || nextTab === "benefits") {
      const employmentValidationMessage = validateEmployeeEmploymentSection(addEmployeeForm);
      if (employmentValidationMessage) {
        setAddEmployeeError(employmentValidationMessage);
        setAddEmployeeActiveTab("employment");
        return;
      }
    }

    setAddEmployeeError("");
    setAddEmployeeActiveTab(nextTab);
  };

  const handleCloseAddEmployeeModal = () => {
    setIsAddEmployeeModalOpen(false);
    setIsAddingEmployee(false);
    setAddEmployeeError("");
    setAddEmployeeActiveTab("personal");
    setAddEmployeeForm(initialEmployeeForm);
  };

  const handleSubmitAddEmployee = async event => {
    event.preventDefault();
    if (!canAddEmployee || isAddingEmployee) return;

    const personalValidationMessage = validateEmployeePersonalSection(addEmployeeForm);
    if (personalValidationMessage) {
      setAddEmployeeError(personalValidationMessage);
      setAddEmployeeActiveTab("personal");
      return;
    }

    const employmentValidationMessage = validateEmployeeEmploymentSection(addEmployeeForm);
    if (employmentValidationMessage) {
      setAddEmployeeError(employmentValidationMessage);
      setAddEmployeeActiveTab("employment");
      return;
    }

    const employeeName = [addEmployeeForm.first_name, addEmployeeForm.middle_name, addEmployeeForm.last_name]
      .map(value => value.trim())
      .filter(Boolean)
      .join(" ");
    const shouldCreate = await confirm({
      title: "Create employee?",
      message: `Create ${employeeName || addEmployeeForm.work_email || "this employee"}?`,
      confirmLabel: "Create"
    });
    if (!shouldCreate) return;

    setIsAddingEmployee(true);
    setAddEmployeeError("");
    try {
      const response = await apiFetch("api/admin/employee_management.php", {
        method: "POST",
        body: JSON.stringify({
          ...addEmployeeForm,
          email: addEmployeeForm.work_email,
          employment_status: addEmployeeForm.employment_status || "Active"
        })
      });

      const generatedEmail = response?.generated_account?.email;
      const generatedPassword = response?.generated_account?.password;
      showToast({
        title: "Employee created",
        message: `${employeeName || generatedEmail || "The employee"} was added successfully.`,
        type: "success"
      });
      if (generatedEmail && generatedPassword) {
        await showMessage({
          title: "Employee created",
          message: `Email: ${generatedEmail}\nPassword: ${generatedPassword}`
        });
      }

      handleCloseAddEmployeeModal();
      await fetchEmployees();
    } catch (error) {
      const message = error?.error ?? error?.message ?? "Unable to add employee.";
      setAddEmployeeError(message);
      showToast({
        title: "Create failed",
        message,
        type: "error"
      });
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleEditEmployeeChange = event => {
    const { name, value } = event.target;

    if (employeeNameFields.has(name)) {
      setEditEmployeeForm(current => ({
        ...current,
        [name]: sanitizeEmployeeName(value)
      }));
      return;
    }

    if (name === "contact_number") {
      let cleaned = value.replace(/\D/g, "");
      cleaned = cleaned.slice(0, 11);

      setEditEmployeeForm(current => ({
        ...current,
        [name]: cleaned
      }));
      return;
    }

    setEditEmployeeForm(current => ({ ...current, [name]: value }));
  };

  const handleOpenEditEmployeeModal = employee => {
    setEditingEmployeeId(employee.id);
    setEditEmployeeForm(mapEmployeeToForm(employee));
    setEditEmployeeError("");
    setEditEmployeeActiveTab("personal");
    setIsEditEmployeeModalOpen(true);
  };

  const handleEditEmployeeTabChange = nextTab => {
    if (nextTab === editEmployeeActiveTab) return;

    if (nextTab === "employment") {
      const personalValidationMessage = validateEmployeePersonalSection(editEmployeeForm);
      if (personalValidationMessage) {
        setEditEmployeeError(personalValidationMessage);
        setEditEmployeeActiveTab("personal");
        return;
      }
    }

    if (editEmployeeActiveTab === "employment" && nextTab !== "employment") {
      const employmentValidationMessage = validateEmployeeEmploymentSection(editEmployeeForm);
      if (employmentValidationMessage) {
        setEditEmployeeError(employmentValidationMessage);
        setEditEmployeeActiveTab("employment");
        return;
      }
    }

    setEditEmployeeError("");
    setEditEmployeeActiveTab(nextTab);
  };

  const handleCloseEditEmployeeModal = () => {
    setIsEditEmployeeModalOpen(false);
    setEditingEmployeeId(null);
    setIsSavingEditEmployee(false);
    setEditEmployeeError("");
    setEditEmployeeActiveTab("personal");
    setEditEmployeeForm(initialEmployeeForm);
  };

  const handleSubmitEditEmployee = async event => {
    event.preventDefault();

    if (!canEditEmployee || isSavingEditEmployee || !editingEmployeeId) return;

    const personalValidationMessage = validateEmployeePersonalSection(editEmployeeForm);
    if (personalValidationMessage) {
      setEditEmployeeError(personalValidationMessage);
      setEditEmployeeActiveTab("personal");
      return;
    }

    const employmentValidationMessage = validateEmployeeEmploymentSection(editEmployeeForm);
    if (employmentValidationMessage) {
      setEditEmployeeError(employmentValidationMessage);
      setEditEmployeeActiveTab("employment");
      return;
    }

    const employeeName = [editEmployeeForm.first_name, editEmployeeForm.middle_name, editEmployeeForm.last_name]
      .map(value => value.trim())
      .filter(Boolean)
      .join(" ");
    const shouldUpdate = await confirm({
      title: "Save employee changes?",
      message: `Update ${employeeName || editEmployeeForm.work_email || "this employee"}?`,
      confirmLabel: "Save"
    });
    if (!shouldUpdate) return;

    setIsSavingEditEmployee(true);
    setEditEmployeeError("");

    try {
      await apiFetch("api/admin/employee_management.php", {
        method: "PUT",
        body: JSON.stringify({
          employee_id: editingEmployeeId,
          ...editEmployeeForm,
          email: editEmployeeForm.work_email,
          employment_status: editEmployeeForm.employment_status || "Active"
        })
      });

      handleCloseEditEmployeeModal();
      await fetchEmployees();
      showToast({
        title: "Employee updated",
        message: `${employeeName || editEmployeeForm.work_email || "The employee"} was updated successfully.`,
        type: "success"
      });
    } catch (error) {
      const message = error?.error ?? error?.message ?? "Unable to update employee.";
      setEditEmployeeError(message);
      showToast({
        title: "Update failed",
        message,
        type: "error"
      });
    } finally {
      setIsSavingEditEmployee(false);
    }
  };

  const handleDeleteEmployee = async employee => {
    if (!canDeleteEmployee || deletingEmployeeId) return;

    const shouldDelete = await confirm({
      title: "Archive employee?",
      message: `Archive ${employee.fullname || employee.email || "this employee"}?`,
      confirmLabel: "Archive",
      variant: "danger"
    });
    if (!shouldDelete) return;

    setDeletingEmployeeId(employee.id);
    setEmployeeError("");
    try {
      await apiFetch("api/admin/control_panel/archive_user.php", {
        method: "POST",
        body: JSON.stringify({ employee_id: employee.id })
      });
      await fetchEmployees();
      showToast({
        title: "Employee archived",
        message: `${employee.fullname || employee.email || "The employee"} was archived successfully.`,
        type: "success"
      });
    } catch (error) {
      const message = error?.error ?? error?.message ?? "Unable to archive employee.";
      setEmployeeError(message);
      showToast({
        title: "Archive failed",
        message,
        type: "error"
      });
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const normalizedEmployeeSearchTerm = employeeSearchTerm.trim().toLowerCase();
  const parsedEmployeeRowsPerPage = Number.parseInt(employeeRowsPerPageInput, 10);
  const employeeRowsPerPage = Number.isFinite(parsedEmployeeRowsPerPage) && parsedEmployeeRowsPerPage > 0
    ? parsedEmployeeRowsPerPage
    : 10;

  const filteredEmployees = employees.filter(employee => {
    if (!normalizedEmployeeSearchTerm) return true;

    const searchableValues = [
      employee.id,
      employee.fullname,
      employee.email,
      employee.position,
      employee.account,
      employee.employee_type,
      employee.employment_status,
      employee.contact_number
    ];

    return searchableValues.some(value =>
      String(value ?? "").toLowerCase().includes(normalizedEmployeeSearchTerm)
    );
  });

  const sortedEmployees = [...filteredEmployees].sort((leftEmployee, rightEmployee) => {
    const leftValue = getEmployeeSortValue(leftEmployee, employeeSortKey);
    const rightValue = getEmployeeSortValue(rightEmployee, employeeSortKey);
    const comparison = compareEmployeeValues(leftValue, rightValue, employeeSortDirection);

    if (comparison !== 0) return comparison;
    return Number(rightEmployee?.id ?? 0) - Number(leftEmployee?.id ?? 0);
  });

  const employeeTotalPages = Math.max(1, Math.ceil(sortedEmployees.length / employeeRowsPerPage));
  const employeeSafeCurrentPage = Math.min(employeeCurrentPage, employeeTotalPages);
  const employeePageStartIndex = (employeeSafeCurrentPage - 1) * employeeRowsPerPage;
  const paginatedEmployees = sortedEmployees.slice(employeePageStartIndex, employeePageStartIndex + employeeRowsPerPage);
  const employeeVisibleStart = sortedEmployees.length === 0 ? 0 : employeePageStartIndex + 1;
  const employeeVisibleEnd = Math.min(employeePageStartIndex + employeeRowsPerPage, sortedEmployees.length);

  useEffect(() => {
    if (employeeCurrentPage !== employeeSafeCurrentPage) {
      setEmployeeCurrentPage(employeeSafeCurrentPage);
    }
  }, [employeeCurrentPage, employeeSafeCurrentPage]);

  return (
    <section className="content">
      <div className="employee-list-toolbar">
        <div>
          <div className="section-title">EMPLOYEE LIST</div>
          <div className="employee-list-count">
            {normalizedEmployeeSearchTerm ? `${filteredEmployees.length} of ${employees.length} Employees` : `${employees.length} Employees`}
          </div>
        </div>
        {canAddEmployee ? (
          <button
            className="btn primary"
            type="button"
            onClick={handleOpenAddEmployeeModal}
          >
            + Add Employee
          </button>
        ) : null}
      </div>

      <div className="employee-list-controls">
        <label className="employee-search-field" htmlFor="employee-search">
          <span className="employee-control-label">Search</span>
          <input
            id="employee-search"
            type="search"
            placeholder="Search name, email, position, account..."
            value={employeeSearchTerm}
            onChange={event => setEmployeeSearchTerm(event.target.value)}
          />
        </label>

        <label className="employee-rows-field" htmlFor="employee-rows-per-page">
          <span className="employee-control-label">Rows per page</span>
          <input
            id="employee-rows-per-page"
            type="text"
            inputMode="numeric"
            placeholder="10"
            value={employeeRowsPerPageInput}
            onChange={handleEmployeeRowsPerPageChange}
            onBlur={handleEmployeeRowsPerPageBlur}
          />
        </label>
      </div>

      {employeeError && <div className="error">{employeeError}</div>}

      {!canViewEmployeeList ? (
        <div className="empty-state">You do not have permission to view the employee list.</div>
      ) : employeeLoading ? (
        <div className="empty-state">Loading employees...</div>
      ) : employees.length === 0 ? (
        <div className="empty-state">No employees found.</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state">No matching employees found.</div>
      ) : (
        <div className="table-card employee-table-card">
          <div className="table-header employee-list-header">
            {employeeTableColumns.map(column => (
              <div key={column.key} className={column.className ?? ""}>
                {column.sortable ? (
                  <button
                    className="employee-sort-button"
                    type="button"
                    onClick={() => handleEmployeeSort(column.key)}
                    aria-label={`Sort by ${column.label}`}
                  >
                    <span>{column.label}</span>
                    <span className="employee-sort-indicator" aria-hidden="true">
                      {employeeSortKey !== column.key ? (
                        <ArrowUpDown size={14} />
                      ) : employeeSortDirection === "asc" ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
              </div>
            ))}
          </div>
          {paginatedEmployees.map(employee => (
            <div key={employee.id} className="table-row employee-list-row">
              <div className="table-cell">{employee.id}</div>
              <div className="table-cell">{employee.fullname || "—"}</div>
              <div className="table-cell">{employee.position || "—"}</div>
              <div className="table-cell">{employee.account || "—"}</div>
              <div className="table-cell">{employee.employee_type || "—"}</div>
              <div className="table-cell">{employee.employment_status || "—"}</div>
              <div className="table-cell">{formatDate(employee.date_hired)}</div>
              <div className="table-cell">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => handleOpenInfoModal(employee)}
                >
                  Info
                </button>
              </div>
              <div className="table-cell employee-actions-cell">
                <div className="employee-actions" role="group" aria-label={`Actions for ${employee.fullname || employee.email || "employee"}`}>
                  {canEditEmployee ? (
                    <button className="btn secondary" type="button" onClick={() => handleOpenEditEmployeeModal(employee)}>
                      Edit
                    </button>
                  ) : null}
                  {canDeleteEmployee ? (
                    <button className="btn danger" type="button" onClick={() => handleDeleteEmployee(employee)} disabled={deletingEmployeeId === employee.id}>
                      {deletingEmployeeId === employee.id ? "Archiving..." : "Delete"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          <div className="employee-table-pagination">
            <div className="employee-pagination-summary">
              Showing {employeeVisibleStart}-{employeeVisibleEnd} of {sortedEmployees.length}
            </div>
            <div className="employee-pagination-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setEmployeeCurrentPage(current => Math.max(1, current - 1))}
                disabled={employeeSafeCurrentPage === 1}
              >
                Previous
              </button>
              <div className="employee-pagination-page">
                Page {employeeSafeCurrentPage} of {employeeTotalPages}
              </div>
              <button
                className="btn secondary"
                type="button"
                onClick={() => setEmployeeCurrentPage(current => Math.min(employeeTotalPages, current + 1))}
                disabled={employeeSafeCurrentPage === employeeTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {isInfoModalOpen && selectedEmployee && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card add-employee-modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Employee Information</div>
                <div className="modal-subtitle">
                  View full employee details
                </div>
              </div>
            </div>

            <hr />
            <br />

            <div className="modal-body">
              <div className="add-employee-grid">

                <div><strong>Full Name:</strong><br />{selectedEmployee.fullname || "—"}</div>
                <div><strong>Email:</strong><br />{selectedEmployee.email || "—"}</div>

                <div><strong>Contact Number:</strong><br />{selectedEmployee.contact_number || "—"}</div>
                <div><strong>Civil Status:</strong><br />{selectedEmployee.civil_status || "—"}</div>

                <div className="add-employee-full-width">
                  <strong>Address:</strong><br />
                  {selectedEmployee.address || "—"}
                </div>

                <div><strong>Birthdate:</strong><br />{formatDate(selectedEmployee.birthdate)}</div>
                <div><strong>Date Hired:</strong><br />{formatDate(selectedEmployee.date_hired)}</div>

                <div><strong>Position:</strong><br />{selectedEmployee.position || "—"}</div>
                <div><strong>Account:</strong><br />{selectedEmployee.account || "—"}</div>

                <div><strong>Employee Type:</strong><br />{selectedEmployee.employee_type || "—"}</div>
                <div><strong>Status:</strong><br />{selectedEmployee.employment_status || "—"}</div>

              </div>
            </div>

            <br />

            <div className="add-employee-footer-actions">
              <button className="btn primary" onClick={handleCloseInfoModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      
      {isAddEmployeeModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-employee-title">
          <div className="modal-card add-employee-modal">
            <div className="modal-header">
              <div>
                <div id="add-employee-title" className="modal-title">Add Employee</div>
                <div className="modal-subtitle">Create a new employee profile and generate account credentials.</div>
              </div>
              <button className="btn link modal-close-btn" type="button" onClick={handleCloseAddEmployeeModal}>
                Close
              </button>
            </div>
            <form className="modal-body add-employee-management-form" onSubmit={handleSubmitAddEmployee}>
              <div className="add-employee-tabs" role="tablist" aria-label="Add employee sections">
                <button type="button" role="tab" aria-selected={addEmployeeActiveTab === "personal"} className={`add-employee-tab ${addEmployeeActiveTab === "personal" ? "active" : ""}`} onClick={() => handleAddEmployeeTabChange("personal")}>Personal Information</button>
                <button type="button" role="tab" aria-selected={addEmployeeActiveTab === "employment"} className={`add-employee-tab ${addEmployeeActiveTab === "employment" ? "active" : ""}`} onClick={() => handleAddEmployeeTabChange("employment")}>Employment Details</button>
                <button type="button" role="tab" aria-selected={addEmployeeActiveTab === "benefits"} className={`add-employee-tab ${addEmployeeActiveTab === "benefits" ? "active" : ""}`} onClick={() => handleAddEmployeeTabChange("benefits")}>Benefit Details</button>
              </div>

              {addEmployeeActiveTab === "personal" && (
                <div className="add-employee-tab-panel" role="tabpanel">
                  <div className="add-employee-grid">
                    <label className="form-field" htmlFor="employee-first-name"><input id="employee-first-name" name="first_name" placeholder="First Name" value={addEmployeeForm.first_name} onChange={handleAddEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." required /></label>
                    <label className="form-field" htmlFor="employee-middle-name"><input id="employee-middle-name" name="middle_name" placeholder="Middle Name" value={addEmployeeForm.middle_name} onChange={handleAddEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." /></label>
                    <label className="form-field add-employee-last-name" htmlFor="employee-last-name"><input id="employee-last-name" name="last_name" placeholder="Last Name" value={addEmployeeForm.last_name} onChange={handleAddEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." required /></label>
                    <label className="form-field add-employee-full-width" htmlFor="employee-address"><input id="employee-address" name="address" placeholder="Address" value={addEmployeeForm.address} onChange={handleAddEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="employee-birthdate"><input id="employee-birthdate" type="date" name="birthdate" value={addEmployeeForm.birthdate} onChange={handleAddEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="employee-contact-number">
                    <input
                        id="employee-contact-number"
                        name="contact_number"
                        placeholder="Contact Number"
                        value={addEmployeeForm.contact_number}
                        onChange={handleAddEmployeeChange}
                        maxLength={11}
                        inputMode="numeric"
                        pattern="09[0-9]{9}"
                        title="Contact number must start with 09 and be 11 digits"
                        required
                      />
                      </label>
                    <label className="form-field" htmlFor="employee-civil-status">
                      <select id="employee-civil-status" name="civil_status" value={addEmployeeForm.civil_status} onChange={handleAddEmployeeChange} required>
                        <option value="">Civil Status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option>
                      </select>
                    </label>
                    <label className="form-field" htmlFor="employee-personal-email"><input id="employee-personal-email" type="email" name="personal_email" placeholder="Personal Email" value={addEmployeeForm.personal_email} onChange={handleAddEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="employee-work-email"><input id="employee-work-email" type="email" name="work_email" placeholder="Work Email" value={addEmployeeForm.work_email} onChange={handleAddEmployeeChange} required /></label>
                  </div>
                </div>
              )}

              {addEmployeeActiveTab === "employment" && (
                <div className="add-employee-tab-panel" role="tabpanel">
                  <div className="add-employee-grid">
                    <label className="form-field" htmlFor="employee-position">
                      <select id="employee-position" name="position" value={addEmployeeForm.position} onChange={handleAddEmployeeChange} required>
                        <option value="">Select Position</option>
                        {employmentPositions.map(position => (
                          <option key={position} value={position}>{position}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field" htmlFor="employee-account">
                      <select id="employee-account" name="account" value={addEmployeeForm.account} onChange={handleAddEmployeeChange} required>
                        <option value="">Select Account</option>
                        {employmentAccounts.map(account => (
                          <option key={account} value={account}>{account}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field" htmlFor="employee-type">
                      <select id="employee-type" name="employee_type" value={addEmployeeForm.employee_type} onChange={handleAddEmployeeChange} required>
                        <option value="">Select Employee Type</option>
                        {employeeTypes.map(employeeType => (
                          <option key={employeeType} value={employeeType}>{employeeType}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {addEmployeeActiveTab === "benefits" && <div className="add-employee-tab-panel" role="tabpanel"><p className="modal-text">Benefits module coming soon...</p></div>}
              {addEmployeeError && <div className="error add-employee-form-error">{addEmployeeError}</div>}

              <div className="add-employee-footer-actions">
                <button className="btn secondary" type="button" onClick={handleCloseAddEmployeeModal} disabled={isAddingEmployee}>Close</button>
                <button className="btn primary" type="submit" disabled={isAddingEmployee}>{isAddingEmployee ? "Creating..." : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditEmployeeModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
          <div className="modal-card add-employee-modal">
            <div className="modal-header">
              <div>
                <div id="edit-employee-title" className="modal-title">Edit Employee</div>
                <div className="modal-subtitle">Update employee profile details.</div>
              </div>
            </div>
            <form className="modal-body add-employee-management-form" onSubmit={handleSubmitEditEmployee}>
              <div className="add-employee-tabs" role="tablist" aria-label="Edit employee sections">
                <button type="button" role="tab" aria-selected={editEmployeeActiveTab === "personal"} className={`add-employee-tab ${editEmployeeActiveTab === "personal" ? "active" : ""}`} onClick={() => handleEditEmployeeTabChange("personal")}>Personal Information</button>
                <button type="button" role="tab" aria-selected={editEmployeeActiveTab === "employment"} className={`add-employee-tab ${editEmployeeActiveTab === "employment" ? "active" : ""}`} onClick={() => handleEditEmployeeTabChange("employment")}>Employment Details</button>
              </div>

              {editEmployeeActiveTab === "personal" && (
                <div className="add-employee-tab-panel" role="tabpanel">
                  <div className="add-employee-grid">
                    <label className="form-field" htmlFor="edit-employee-first-name"><input id="edit-employee-first-name" name="first_name" placeholder="First Name" value={editEmployeeForm.first_name} onChange={handleEditEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." required /></label>
                    <label className="form-field" htmlFor="edit-employee-middle-name"><input id="edit-employee-middle-name" name="middle_name" placeholder="Middle Name" value={editEmployeeForm.middle_name} onChange={handleEditEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." /></label>
                    <label className="form-field add-employee-last-name" htmlFor="edit-employee-last-name"><input id="edit-employee-last-name" name="last_name" placeholder="Last Name" value={editEmployeeForm.last_name} onChange={handleEditEmployeeChange} onKeyDown={handleEmployeeNameKeyDown} title="Names cannot contain numbers." required /></label>
                    <label className="form-field add-employee-full-width" htmlFor="edit-employee-address"><input id="edit-employee-address" name="address" placeholder="Address" value={editEmployeeForm.address} onChange={handleEditEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="edit-employee-birthdate"><input id="edit-employee-birthdate" type="date" name="birthdate" value={editEmployeeForm.birthdate} onChange={handleEditEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="edit-employee-contact-number">
                    <input
                      id="edit-employee-contact-number"
                      name="contact_number"
                      placeholder="Contact Number"
                      value={editEmployeeForm.contact_number}
                      onChange={handleEditEmployeeChange}
                      maxLength={11}
                      inputMode="numeric"
                      pattern="09[0-9]{9}"
                      title="Contact number must start with 09 and be 11 digits"
                      required
                    /></label>
                    <label className="form-field" htmlFor="edit-employee-civil-status">
                      <select id="edit-employee-civil-status" name="civil_status" value={editEmployeeForm.civil_status} onChange={handleEditEmployeeChange} required>
                        <option value="">Civil Status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option>
                      </select>
                    </label>
                    <label className="form-field" htmlFor="edit-employee-personal-email"><input id="edit-employee-personal-email" type="email" name="personal_email" placeholder="Personal Email" value={editEmployeeForm.personal_email} onChange={handleEditEmployeeChange} required /></label>
                    <label className="form-field" htmlFor="edit-employee-work-email"><input id="edit-employee-work-email" type="email" name="work_email" placeholder="Work Email" value={editEmployeeForm.work_email} onChange={handleEditEmployeeChange} required /></label>
                  </div>
                </div>
              )}

              {editEmployeeActiveTab === "employment" && (
                <div className="add-employee-tab-panel" role="tabpanel">
                  <div className="add-employee-grid">
                    <label className="form-field" htmlFor="edit-employee-position">
                      <select id="edit-employee-position" name="position" value={editEmployeeForm.position} onChange={handleEditEmployeeChange} required>
                        <option value="">Select Position</option>
                        {employmentPositions.map(position => (
                          <option key={position} value={position}>{position}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field" htmlFor="edit-employee-account">
                      <select id="edit-employee-account" name="account" value={editEmployeeForm.account} onChange={handleEditEmployeeChange} required>
                        <option value="">Select Account</option>
                        {employmentAccounts.map(account => (
                          <option key={account} value={account}>{account}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field" htmlFor="edit-employee-type">
                      <select id="edit-employee-type" name="employee_type" value={editEmployeeForm.employee_type} onChange={handleEditEmployeeChange} required>
                        <option value="">Select Employee Type</option>
                        {employeeTypes.map(employeeType => (
                          <option key={employeeType} value={employeeType}>{employeeType}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {editEmployeeError && <div className="error add-employee-form-error">{editEmployeeError}</div>}

              <div className="add-employee-footer-actions">
                <button className="btn secondary" type="button" onClick={handleCloseEditEmployeeModal} disabled={isSavingEditEmployee}>Close</button>
                <button className="btn primary" type="submit" disabled={isSavingEditEmployee}>{isSavingEditEmployee ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
