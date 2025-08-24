# Alef University - Student Information System (SIS)

A comprehensive **Student Information System** implementing role-based academic management with American grading standards. Built on Convex serverless architecture with TypeScript for scalable university operations.

## System Overview

The SIS implements a **complete academic management platform** with specialized interfaces for three primary user roles:

**Student Interface**
- Academic progress dashboard with program completion tracking
- Interactive curriculum visualization showing completed and pending courses
- Comprehensive grade history with GPA calculations
- Document generation capabilities for certificates and transcripts

**Professor Interface** 
- Section management with enrollment rosters
- Grade submission system using percentage-based American grading
- Teaching history with performance analytics
- Calendar integration for class scheduling

**Administrative Interface**
- Program and course catalog management
- Period administration with enrollment controls
- User management with role-based permissions
- System analytics and reporting tools

## Business Process Model

The system follows a **bimester-based academic calendar** with role-specific interaction sequences:

```mermaid
sequenceDiagram
    autonumber
    participant Admin
    participant Professor
    participant Student
    participant SIS as SIS Backend
    participant Auth as Authentication
    
    Note over Admin, Auth: Period Setup & Configuration
    Admin->>SIS: Create new period
    Admin->>SIS: Configure enrollment dates
    Admin->>SIS: Create course sections
    Admin->>Professor: Assign sections
    
    Note over Professor, SIS: Section Preparation
    Professor->>Auth: Login to system
    Professor->>SIS: Review assigned sections
    Professor->>SIS: Update section details
    
    Note over Student, SIS: Enrollment Phase
    Student->>Auth: Login to dashboard
    Student->>SIS: View available courses
    Student->>SIS: Check prerequisites
    SIS->>SIS: Validate enrollment eligibility
    break when prerequisites not met
        SIS->>Student: Show prerequisite requirements
    end
    Student->>SIS: Submit enrollment request
    SIS->>Student: Confirm enrollment
    
    Note over Professor, Student: Active Teaching Period
    Professor->>SIS: Access class roster
    Professor->>SIS: Post announcements
    loop Throughout period
        Professor->>SIS: Update attendance/participation
    end
    
    Note over Professor, SIS: Grade Submission
    Professor->>SIS: Access gradebook
    Professor->>SIS: Enter percentage grades
    SIS->>SIS: Calculate letter grades & GPA
    Professor->>SIS: Submit final grades
    
    Note over Student, SIS: Grade Review & Progress
    Student->>SIS: View updated grades
    SIS->>Student: Display GPA calculation
    SIS->>Student: Show academic progress
    Student->>SIS: Request transcript
    SIS->>Student: Generate document
    
    Note over Admin, SIS: Period Closure & Analytics
    Admin->>SIS: Review period statistics
    Admin->>SIS: Close enrollment period
    SIS->>SIS: Calculate final rankings
    Admin->>SIS: Generate period reports
```

## Academic Model & Grading System

### Academic Structure
- **Bimester-based periods**: 6 periods per academic year (planning → enrollment → active → grading → closed)
- **Credit categorization**: humanities, core, elective, general course types
- **Program types**: diploma, bachelor, master, doctorate degrees
- **Prerequisite validation**: automated course eligibility verification

### American Grading Standards
- **Percentage grades**: 0-100% input by professors
- **Letter grades**: Automatic conversion (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F)
- **GPA calculation**: 4.0 scale with quality points computation
- **Passing threshold**: 65% minimum for course completion

### Navigation Structure
The frontend implements role-specific navigation following this architecture:

```
app/[locale]/(dashboard)/
├── page.tsx                    # Role-based dashboard entry point
├── academic/                   # Student academic section
│   ├── page.tsx               # Enrollment history and grades
│   ├── history/               # Complete academic transcript
│   └── progress/              # Visual progress tracking
├── teaching/                   # Professor section
│   ├── page.tsx               # Teaching overview
│   ├── gradebook/             # Grade management interface
│   └── progress/              # Teaching analytics
├── admin/                      # Administrative section
│   ├── page.tsx               # System overview
│   ├── courses/               # Course catalog management
│   ├── periods/               # Academic period control
│   ├── professors/            # Faculty management
│   ├── programs/              # Program administration
│   ├── students/              # Student records
│   └── users/                 # User account management
└── docs/                      # Documentation section
    ├── admin/                 # Administrative guides
    ├── progress/              # Progress interpretation
    ├── teaching/              # Faculty resources
    └── transcripts/           # Document procedures
```

## Convex Backend Structure

The system organizes business logic across specialized function modules:

### Core Function Modules
- **`auth.ts`**: Clerk authentication integration and user registration workflows
- **`users.ts`**: User profile management with role-based data access
- **`programs.ts`**: Academic program administration and requirement definitions
- **`courses.ts`**: Course catalog management with prerequisite handling
- **`sections.ts`**: Class section creation with professor assignment and scheduling
- **`enrollments.ts`**: Student enrollment processing and grade submission
- **`studentDashboard.ts`**: Academic progress calculations and transcript generation
- **`professorDashboard.ts`**: Teaching analytics and gradebook management
- **`admin.ts`**: Administrative operations and system-wide statistics

### Foundation Files
- **`schema.ts`**: Complete database schema with performance-optimized indexes
- **`types.ts`**: TypeScript interfaces, validators, and business rule definitions
- **`helpers.ts`**: Pure business logic functions for grade calculations and validations
- **`auth.config.ts`**: Clerk authentication provider configuration

## Database Schema Architecture

The system utilizes **10 core tables** optimized for academic operations with strategic indexing for performance:

```mermaid
erDiagram
    USERS ||--o{ ENROLLMENTS : "student enrolls"
    USERS ||--o{ SECTIONS : "professor teaches"
    USERS ||--o{ DOCUMENT_LOGS : "generates documents"
    
    PROGRAMS ||--o{ USERS : "student belongs to"
    PROGRAMS ||--o{ PROGRAM_COURSES : "contains"
    PROGRAMS ||--o{ PROGRAM_REQUIREMENTS : "defines requirements"
    
    PERIODS ||--o{ SECTIONS : "scheduled during"
    PERIODS ||--o{ ENROLLMENTS : "enrollment period"
    
    COURSES ||--o{ PROGRAM_COURSES : "assigned to programs"
    COURSES ||--o{ SECTIONS : "offered as sections"
    
    SECTIONS ||--o{ ENROLLMENTS : "has students"
    SECTIONS ||--o{ ANNOUNCEMENTS : "contains"

    USERS {
        string clerkId PK "Authentication ID"
        string email UK "User email"
        string firstName "Given name"
        string lastName "Family name"
        string secondLastName "Latin American naming"
        enum role "student|professor|admin|superadmin"
        boolean isActive "Account status"
        object studentProfile "Student-specific data"
        object professorProfile "Faculty-specific data"
        object address "Contact information"
        string phone "Contact number"
    }
    
    PROGRAMS {
        string code PK "Program identifier"
        string nameEs "Spanish name"
        string nameEn "English name"
        enum type "diploma|bachelor|master|doctorate"
        enum language "es|en|both"
        number totalCredits "Required credits"
        number durationBimesters "Program length"
        boolean isActive "Program status"
    }
    
    PERIODS {
        string code PK "Period identifier"
        number year "Academic year"
        number bimesterNumber "1-6"
        string nameEs "Period name Spanish"
        string nameEn "Period name English"
        number startDate "Period start"
        number endDate "Period end"
        number enrollmentStart "Registration opens"
        number enrollmentEnd "Registration closes"
        number gradingDeadline "Grade submission due"
        enum status "planning|enrollment|active|grading|closed"
        boolean isCurrentPeriod "Active period flag"
    }
    
    COURSES {
        string code PK "Course code"
        string nameEs "Spanish course name"
        string nameEn "English course name"
        number credits "Credit value"
        enum category "humanities|core|elective|general"
        enum language "es|en|both"
        array prerequisites "Required course codes"
        boolean isActive "Course availability"
    }
    
    PROGRAM_COURSES {
        id programId FK "Program reference"
        id courseId FK "Course reference"
        enum categoryOverride "Program-specific category"
        boolean isRequired "Mandatory for program"
        boolean isActive "Relationship status"
    }
    
    SECTIONS {
        id courseId FK "Course reference"
        id periodId FK "Period reference"
        string groupNumber "Section identifier"
        string crn PK "Course Reference Number"
        id professorId FK "Instructor"
        number capacity "Maximum enrollment"
        number enrolled "Current enrollment"
        enum deliveryMethod "online_sync|online_async|hybrid|in_person"
        object schedule "Class timing"
        enum status "draft|open|closed|active|grading|completed"
        boolean gradesSubmitted "Grade entry status"
    }
    
    ENROLLMENTS {
        id studentId FK "Student reference"
        id sectionId FK "Section reference"
        id periodId FK "Period reference (denormalized)"
        id courseId FK "Course reference (denormalized)"
        enum status "enrolled|withdrawn|completed|failed|in_progress"
        number percentageGrade "0-100 professor input"
        string letterGrade "A+, A, A-, B+, etc"
        number gradePoints "4.0 scale value"
        number qualityPoints "gradePoints × credits"
        boolean isRetake "Repeat attempt flag"
        boolean countsForGPA "GPA inclusion flag"
    }
    
    PROGRAM_REQUIREMENTS {
        id programId FK "Program reference"
        object requirements "Credit distribution"
        number minGPA "Graduation threshold"
        number maxBimesters "Time limit"
        number effectiveDate "Requirements start"
        boolean isActive "Current requirements"
    }
    
    ANNOUNCEMENTS {
        id sectionId FK "Section reference"
        id authorId FK "Author reference"
        string title "Announcement title"
        string content "Message body"
        enum type "general|assignment|exam|schedule|urgent"
        boolean isPublished "Visibility status"
        number publishedAt "Publication time"
    }
    
    DOCUMENT_LOGS {
        id requestedBy FK "Requester"
        id requestedFor FK "Document subject"
        enum documentType "transcript|certificate|report"
        object scope "Document parameters"
        enum format "pdf|html|csv"
        enum language "es|en"
        enum status "pending|generating|completed|failed"
        number generatedAt "Creation timestamp"
        string documentUrl "File location"
    }
```

## Business Logic Implementation

### Core Academic Operations

**Enrollment Validation**
- Prerequisite completion verification using course code dependencies
- Section capacity management with waitlist support
- Period-based enrollment window enforcement
- Duplicate enrollment prevention within the same period

**Grade Processing**
- American percentage-based grading (0-100%) with automatic letter grade conversion
- GPA calculation using 4.0 scale with quality points
- Support for incomplete grades with deadline tracking
- Retake handling with GPA impact configuration

**Academic Progress Tracking**
- Credit categorization by program requirements (humanities, core, elective, general)
- Real-time progress calculation with completion percentages  
- Academic standing determination based on GPA thresholds
- Graduation requirement validation

### Key Helper Functions

```typescript
// Grade calculation helpers from helpers.ts
calculateLetterGrade(percentageGrade: number): string
calculateGradePoints(percentageGrade: number): number  
calculateGPA(enrollments: Doc<"enrollments">[]): Promise<GradeSummary>

// Enrollment validation helpers
validatePrerequisites(studentId: Id<"users">, courseId: Id<"courses">): Promise<PrerequisiteValidation>
validateEnrollment(studentId: Id<"users">, sectionId: Id<"sections">): Promise<EnrollmentValidation>

// Academic progress helpers  
calculateAcademicProgress(studentId: Id<"users">): Promise<AcademicProgress>
validateGraduationRequirements(studentId: Id<"users">): Promise<GraduationValidation>
```

## Technical Architecture

### Performance Optimization
- **Strategic indexing**: Compound indexes for dashboard queries and enrollment lookups
- **Denormalization**: Period and course IDs stored in enrollments for efficient queries
- **Type safety**: End-to-end TypeScript with Convex validators
- **Serverless scalability**: Convex handles infrastructure scaling automatically

### Security & Authentication
- **Clerk integration**: Secure authentication with role-based access control
- **Role-based permissions**: Student, professor, admin, superadmin access levels
- **Data validation**: Server-side validation for all mutations
- **Audit trail**: Document generation logging with user tracking
```typescript
// NO complex activities table - grades stored directly in enrollments
interface Enrollment {
  finalGrade: number;      // CAL (1-5 scale)
  makeupGrade: number;     // HAB (0-100 scale) 
  effectiveGrade: number;  // What counts (makeup replaces final)
  letterGrade: string;     // For transcripts
}
```

**Optimized Queries**
### Index Strategy
The schema implements performance-optimized compound indexes for common query patterns:

```typescript
// Student dashboard queries
.withIndex("by_student_period", ["studentId", "periodId"])
.withIndex("by_student_section", ["studentId", "sectionId"])

// Professor dashboard queries  
.withIndex("by_professor_period", ["professorId", "periodId", "isActive"])
.withIndex("by_section", ["sectionId"])

// Administrative queries
.withIndex("by_program_course", ["programId", "courseId"])
.withIndex("by_period_status_active", ["periodId", "status", "isActive"])
```

## System Capabilities & Scale

The backend supports a comprehensive Student Information System designed for medium-scale academic institutions:

| **Core Functionality** | **Implementation Status** | **Target Scale** |
|-------------------------|---------------------------|------------------|
| **User Management** | Complete with role-based access | 250+ students, 20+ professors |
| **Academic Programs** | Multi-program support with shared courses | Unlimited programs |
| **Period Management** | Bimester-based with enrollment windows | 6 periods per year |
| **Course Catalog** | Prerequisite-aware with categorization | Unlimited courses |
| **Section Scheduling** | Professor assignment with capacity control | Multiple sections per course |
| **Grade Processing** | American system with GPA calculation | Real-time processing |
| **Progress Tracking** | Category-based credit distribution | Dynamic calculations |
| **Document Generation** | Audit-logged transcript and certificate generation | On-demand processing |
| **Analytics Support** | Performance metrics for all user roles | Real-time dashboards |

### Deployment Requirements

**Environment Configuration**
```bash
# Required environment variables
CONVEX_DEPLOYMENT=your-deployment-url
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-public-key  
CLERK_SECRET_KEY=your-clerk-secret-key
```

**Database Deployment**
```bash
# Schema deployment with Convex
npx convex deploy
# Automatic index creation and optimization
```

The system is production-ready with comprehensive validation, audit trails, and performance optimizations suitable for academic institution requirements.

