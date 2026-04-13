-- Seed the demo tenant
INSERT INTO public.tenants (id, name, city, subscription_tier)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Delhi Public School', 'New Delhi', 'growth')
ON CONFLICT (id) DO NOTHING;

-- Seed sample students
INSERT INTO public.students (tenant_id, first_name, last_name, class_grade, section, roll_number, guardian_name, guardian_phone, status)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Arjun', 'Mehta', 'Grade 6', 'A', '101', 'Rajesh Mehta', '+919988776655', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Priya', 'Sharma', 'Grade 6', 'B', '102', 'Sanjay Sharma', '+919988776656', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Rahul', 'Verma', 'Grade 7', 'A', '201', 'Vikram Verma', '+919988776657', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Sneha', 'Gupta', 'Grade 8', 'C', '301', 'Anil Gupta', '+919988776658', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Vikram', 'Singh', 'Grade 10', 'A', '405', 'Rajendra Singh', '+919988776659', 'active')
ON CONFLICT DO NOTHING;

-- Seed hostel rooms
INSERT INTO public.hostel_rooms (tenant_id, room_number, block_name, room_type, capacity, floor_level, status, occupied)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', '101', 'A Block', 'Dormitory', 8, 1, 'full', 8),
    ('550e8400-e29b-41d4-a716-446655440000', '102', 'A Block', 'Dormitory', 8, 1, 'partial', 4),
    ('550e8400-e29b-41d4-a716-446655440000', '103', 'A Block', 'Semi-Private', 4, 1, 'vacant', 0),
    ('550e8400-e29b-41d4-a716-446655440000', '201', 'B Block', 'Dormitory', 10, 2, 'full', 10),
    ('550e8400-e29b-41d4-a716-446655440000', '202', 'B Block', 'Private', 2, 2, 'vacant', 0),
    ('550e8400-e29b-41d4-a716-446655440000', '203', 'B Block', 'Dormitory', 10, 2, 'partial', 5),
    ('550e8400-e29b-41d4-a716-446655440000', '301', 'C Block', 'Private', 2, 3, 'partial', 1),
    ('550e8400-e29b-41d4-a716-446655440000', '302', 'C Block', 'Semi-Private', 4, 3, 'vacant', 0)
ON CONFLICT DO NOTHING;

-- Seed demo exams
INSERT INTO public.exams (tenant_id, title, subject, class_grade, exam_date, max_marks, status)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Mid-Term Exam', 'Mathematics', 'Grade 6', '2026-05-15', 100, 'upcoming'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Weekly Test', 'Science', 'Grade 6', '2026-04-10', 50, 'upcoming'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Final Exam', 'English', 'Grade 8', '2026-12-10', 100, 'upcoming')
ON CONFLICT DO NOTHING;
