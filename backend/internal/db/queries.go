package db

import (
	"context"
	"time"
)

type User struct {
	ID          string
	GithubLogin *string
	DisplayName *string
	AvatarURL   *string
}

type ChatMessage struct {
	ID        string
	ProjectID string
	Body      string
	CreatedAt time.Time
	User      User
}

type Member struct {
	User      User
	PresenceAt *time.Time
}

// RecentMessages returns up to limit messages for a project, oldest first.
func RecentMessages(ctx context.Context, projectID string, since *time.Time, limit int) ([]ChatMessage, error) {
	var rows []ChatMessage

	query := `
		SELECT cm.id, cm.project_id, cm.body, cm.created_at,
		       u.id, u.github_login, u.display_name, u.avatar_url
		FROM "ChatMessage" cm
		JOIN "User" u ON u.id = cm.user_id
		WHERE cm.project_id = $1`
	args := []any{projectID}

	if since != nil {
		query += ` AND cm.created_at > $2 ORDER BY cm.created_at ASC LIMIT $3`
		args = append(args, *since, limit)
	} else {
		query += ` ORDER BY cm.created_at DESC LIMIT $2`
		args = append(args, limit)
	}

	dbRows, err := Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer dbRows.Close()

	for dbRows.Next() {
		var m ChatMessage
		err := dbRows.Scan(
			&m.ID, &m.ProjectID, &m.Body, &m.CreatedAt,
			&m.User.ID, &m.User.GithubLogin, &m.User.DisplayName, &m.User.AvatarURL,
		)
		if err != nil {
			return nil, err
		}
		rows = append(rows, m)
	}

	// Reverse if we did DESC (initial load)
	if since == nil {
		for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
			rows[i], rows[j] = rows[j], rows[i]
		}
	}

	return rows, nil
}

// InsertMessage persists a new chat message and returns it with user info.
func InsertMessage(ctx context.Context, projectID, userID, body string) (*ChatMessage, error) {
	const q = `
		WITH ins AS (
			INSERT INTO "ChatMessage" (id, project_id, user_id, body, created_at)
			VALUES (gen_random_uuid(), $1, $2, $3, NOW())
			RETURNING id, project_id, body, created_at, user_id
		)
		SELECT ins.id, ins.project_id, ins.body, ins.created_at,
		       u.id, u.github_login, u.display_name, u.avatar_url
		FROM ins JOIN "User" u ON u.id = ins.user_id`

	var m ChatMessage
	err := Pool.QueryRow(ctx, q, projectID, userID, body).Scan(
		&m.ID, &m.ProjectID, &m.Body, &m.CreatedAt,
		&m.User.ID, &m.User.GithubLogin, &m.User.DisplayName, &m.User.AvatarURL,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// ProjectIDBySlug resolves a project slug to its internal ID.
func ProjectIDBySlug(ctx context.Context, slug string) (string, error) {
	var id string
	err := Pool.QueryRow(ctx, `SELECT id FROM "Project" WHERE slug = $1`, slug).Scan(&id)
	return id, err
}

// IsMember returns true if the user is an active member of the project.
func IsMember(ctx context.Context, projectID, userID string) (bool, error) {
	var exists bool
	err := Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM "Membership" WHERE project_id = $1 AND user_id = $2 AND left_at IS NULL)`,
		projectID, userID,
	).Scan(&exists)
	return exists, err
}

type MemberUserResult struct {
	ID          string
	DisplayName string // githubLogin fallback if display_name is null
}

// MemberUser fetches basic user info for an active member, or errors if not a member.
func MemberUser(ctx context.Context, projectID, userID string) (*MemberUserResult, error) {
	const q = `
		SELECT u.id, COALESCE(u.display_name, u.github_login, u.id)
		FROM "Membership" m
		JOIN "User" u ON u.id = m.user_id
		WHERE m.project_id = $1 AND m.user_id = $2 AND m.left_at IS NULL`
	var r MemberUserResult
	err := Pool.QueryRow(ctx, q, projectID, userID).Scan(&r.ID, &r.DisplayName)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// Members returns all active members of a project with their last presence time.
func Members(ctx context.Context, projectID string) ([]Member, error) {
	const q = `
		SELECT u.id, u.github_login, u.display_name, u.avatar_url, m.presence_at
		FROM "Membership" m
		JOIN "User" u ON u.id = m.user_id
		WHERE m.project_id = $1 AND m.left_at IS NULL
		ORDER BY m.joined_at ASC`

	rows, err := Pool.Query(ctx, q, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var mem Member
		err := rows.Scan(
			&mem.User.ID, &mem.User.GithubLogin, &mem.User.DisplayName, &mem.User.AvatarURL,
			&mem.PresenceAt,
		)
		if err != nil {
			return nil, err
		}
		members = append(members, mem)
	}
	return members, nil
}

// UpdatePresence bumps the presenceAt timestamp for a membership.
func UpdatePresence(ctx context.Context, projectID, userID string) error {
	_, err := Pool.Exec(ctx,
		`UPDATE "Membership" SET presence_at = NOW() WHERE project_id = $1 AND user_id = $2 AND left_at IS NULL`,
		projectID, userID,
	)
	return err
}
