# app/utils/workflow_utils.py

#--------------------------------------------------------------------------------------------------------------
#    Flows
#--------------------------------------------------------------------------------------------------------------

def update_flow(cursor, flow_id, data, parent=True):
    cursor.execute("""
        UPDATE steps 
        SET name = ?, description = ?, min_permission_level = ?, is_locked = ?
        WHERE id = ? AND parent_id {} NULL
    """.format("IS" if parent else "IS NOT"), (
        data['name'],
        data.get('description', ''),
        data.get('min_permission_level', 1),
        data.get('is_locked', 0),
        flow_id
    ))

    if cursor.rowcount == 0:
        return None

    cursor.execute("""
        SELECT id, name, description, min_permission_level, is_locked
        FROM steps
        WHERE id = ?
    """, (flow_id,))
    row = cursor.fetchone()
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "min_permission_level": row["min_permission_level"],
        "is_locked": row["is_locked"]
    } if row else None

def get_flow_by_id(cursor, flow_id, parent=True):
    cursor.execute(f"""
        SELECT id, name, description, min_permission_level, is_locked
        FROM steps
        WHERE id = ? AND parent_id {'IS NULL' if parent else 'IS NOT NULL'}
    """, (flow_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "min_permission_level": row["min_permission_level"],
        "is_locked": row["is_locked"]
    }

#--------------------------------------------------------------------------------------------------------------
#    Parent and Individual flows
#--------------------------------------------------------------------------------------------------------------
def create_parent_flow_entry(cursor, data):
    min_permission_level = int(data.get('min_permission_level', 1))

    cursor.execute("SELECT MAX(workflow_id) FROM steps")
    max_workflow_id = cursor.fetchone()[0] or 0
    new_workflow_id = max_workflow_id + 1

    cursor.execute("""
        INSERT INTO steps (name, description, parent_id, min_permission_level, workflow_id)
        VALUES (?, ?, NULL, ?, ?)
    """, (
        data['name'],
        data.get('description', ''),
        min_permission_level,
        new_workflow_id
    ))

    flow_id = cursor.lastrowid

    cursor.execute("SELECT id, name, min_permission_level, workflow_id FROM steps WHERE id = ?", (flow_id,))
    row = cursor.fetchone()
    return {
        "id": row['id'],
        "name": row['name'],
        "min_permission_level": row['min_permission_level'],
        "workflow_id": row['workflow_id']
    }

def get_parent_flow_by_id(cursor, flow_id):
    cursor.execute("""
        SELECT id, name, description, min_permission_level, is_locked
        FROM steps
        WHERE id = ? AND parent_id IS NULL
    """, (flow_id,))
    row = cursor.fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "min_permission_level": row["min_permission_level"],
        "is_locked": row["is_locked"]
    }

def update_parent_flow(cursor, flow_id, data):
    cursor.execute("""
        UPDATE steps 
        SET name = ?, description = ?, min_permission_level = ?, is_locked = ?
        WHERE id = ? AND parent_id IS NULL
    """, (
        data['name'],
        data.get('description', ''),
        data.get('min_permission_level', 1),
        data.get('is_locked', 0),
        flow_id
    ))

    cursor.execute("""
        SELECT id, name, description, min_permission_level, is_locked
        FROM steps
        WHERE id = ?
    """, (flow_id,))
    row = cursor.fetchone()
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "min_permission_level": row["min_permission_level"],
        "is_locked": row["is_locked"]
    } if row else None

def delete_parent_flow(cursor, flow_id):
    cursor.execute("DELETE FROM steps WHERE parent_id = ?", (flow_id,))
    child_count = cursor.rowcount
    cursor.execute("DELETE FROM steps WHERE id = ?", (flow_id,))
    if cursor.rowcount == 0:
        return {"success": False, "message": "Flow not found"}
    return {"success": True, "message": f"Deleted flow and {child_count} child steps"}

def update_individual_flow(cursor, flow_id, data):
    cursor.execute("""
        UPDATE steps 
        SET name = ?, description = ?, min_permission_level = ?, is_locked = ?
        WHERE id = ? AND parent_id IS NOT NULL
    """, (
        data['name'],
        data.get('description', ''),
        data.get('min_permission_level', 1),
        data.get('is_locked', 0),
        flow_id
    ))
    if cursor.rowcount == 0:
        return None

    cursor.execute("""
        SELECT id, name, description, min_permission_level, is_locked
        FROM steps
        WHERE id = ?
    """, (flow_id,))
    row = cursor.fetchone()
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"] or "",
        "min_permission_level": row["min_permission_level"],
        "is_locked": row["is_locked"]
    } if row else None

def delete_individual_flow(cursor, flow_id):
    try:
        # 1. Delete links where this flow’s nodes are parents or children
        cursor.execute("""
            DELETE FROM links 
            WHERE parent_node_id IN (SELECT id FROM nodes WHERE step_id = ?)
               OR child_node_id IN (SELECT id FROM nodes WHERE step_id = ?)
               OR to_flow_id = ?
        """, (flow_id, flow_id, flow_id))

        # 2. Delete statuses tied to this flow
        cursor.execute("DELETE FROM individual_assignment_statuses WHERE step_id = ?", (flow_id,))

        # 3. Delete nodes for this flow
        cursor.execute("DELETE FROM nodes WHERE step_id = ?", (flow_id,))

        # 4. Delete the flow itself (only if it’s an individual flow, not a parent)
        cursor.execute("DELETE FROM steps WHERE id = ? AND parent_id IS NOT NULL", (flow_id,))
        if cursor.rowcount == 0:
            return {"success": False, "error": "Flow not found"}

        return {"success": True, "message": "Flow deleted successfully"}

    except Exception as e:
        return {"success": False, "error": str(e)}


#--------------------------------------------------------------------------------------------------------------
#    NODES
#--------------------------------------------------------------------------------------------------------------
def insert_node(cursor, data):
    cursor.execute("""
        INSERT INTO nodes (name, step_id, position, color, completion_percentage)
        VALUES (?, ?, ?, ?, ?);
    """, (
        data['name'],
        data['step_id'],
        data.get('position', '0 0'),
        data.get('color', '#FFFFFF'),
        data.get('completion_percentage', 0)
    ))
    return cursor.lastrowid

def fetch_nodes(cursor, step_id):
    cursor.execute("""
        SELECT 
            nodes.id AS key, 
            nodes.name AS text, 
            nodes.position AS loc, 
            nodes.color, 
            nodes.step_id,
            nodes.completion_percentage,
            EXISTS (
                SELECT 1 
                FROM links 
                WHERE links.parent_node_id = nodes.id 
                  AND links.to_flow_id IS NOT NULL
            ) AS hasCrossFlow
        FROM nodes
        WHERE nodes.step_id = ?
    """, (step_id,))

    nodes = [dict(row) for row in cursor.fetchall()]

    for node in nodes:
        loc = node['loc']
        if loc:
            loc_parts = loc.replace("Point(", "").replace(")", "").replace(",", "").split()
            if len(loc_parts) == 2:
                node['loc'] = f"{float(loc_parts[0]):.1f} {float(loc_parts[1]):.1f}"
            else:
                print(f"âš ï¸ Unexpected loc format for node {node['key']}: {loc}")
        else:
            print(f"âš ï¸ Node {node['key']} has no loc.")

    return nodes

def fetch_overview_nodes_and_links(cursor, parent_id):
    child_step_ids = [row['id'] for row in cursor.execute(
        "SELECT id FROM steps WHERE parent_id = ?", (parent_id,)
    ).fetchall()]

    if not child_step_ids:
        return [], []

    step_ids_placeholders = ','.join(['?'] * len(child_step_ids))

    cursor.execute(f"""
        SELECT 
            nodes.id AS key, nodes.name AS text, nodes.color, 
            nodes.position AS loc, nodes.step_id, steps.order_num, 
            steps.name AS step_name,
            EXISTS (
                SELECT 1 FROM links 
                WHERE links.parent_node_id = nodes.id 
                AND links.to_flow_id IS NOT NULL
            ) AS hasCrossFlow
        FROM nodes
        JOIN steps ON steps.id = nodes.step_id
        WHERE nodes.step_id IN ({step_ids_placeholders})
        ORDER BY steps.order_num ASC
    """, child_step_ids)
    nodes = [dict(row) for row in cursor.fetchall()]

    cursor.execute(f"""
        SELECT parent_node_id AS "from", child_node_id AS "to", to_flow_id,
               CASE WHEN to_flow_id IS NOT NULL THEN 1 ELSE 0 END AS isCrossflow
        FROM links
        WHERE step_id IN ({step_ids_placeholders})
          AND (to_flow_id IS NULL OR to_flow_id IN ({step_ids_placeholders}))
    """, child_step_ids * 2)
    links = [dict(row) for row in cursor.fetchall()]

    return nodes, links

def update_node_details(cursor, node_id, data):
    name = data.get("name")
    color = data.get("color")
    completion_percentage = data.get("completion_percentage", 0)
    position = data.get("position")

    cursor.execute("""
        UPDATE nodes 
        SET name = ?, color = ?, completion_percentage = ?, position = ?
        WHERE id = ?
    """, (name, color, completion_percentage, position, node_id))

def save_nodes(cursor, step_id, nodes):
    for node in nodes:
        cursor.execute("""
            INSERT INTO nodes (name, step_id, position, color, completion_percentage) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(name, step_id) DO UPDATE 
            SET position=excluded.position, color=excluded.color, completion_percentage=excluded.completion_percentage
        """, (
            node["text"],
            step_id,
            node["loc"],
            node["color"],
            node.get("completion_percentage", 0),
        ))
        node["key"] = cursor.lastrowid or node.get("key")

#--------------------------------------------------------------------------------------------------------------
#    LINKS
#--------------------------------------------------------------------------------------------------------------

def cleanup_orphan_links(cursor):
    cursor.execute("""
        DELETE FROM links 
        WHERE (parent_node_id NOT IN (SELECT id FROM nodes)
           OR child_node_id NOT IN (SELECT id FROM nodes))
          AND to_flow_id IS NULL;
    """)

def save_links(cursor, step_id, links):
    cursor.execute("SELECT parent_node_id, child_node_id, to_flow_id FROM links WHERE step_id = ?", (step_id,))
    existing_links = {(row[0], row[1], row[2]) for row in cursor.fetchall()}

    for link in links:
        from_node = link["from"]
        to_node = link["to"]
        to_flow_id = link.get("to_flow_id")

        if (from_node, to_node, to_flow_id) in existing_links:
            continue

        if to_flow_id is not None:
            cursor.execute("""
                INSERT INTO links (parent_node_id, child_node_id, step_id, to_flow_id)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(parent_node_id, child_node_id, step_id) DO UPDATE 
                SET to_flow_id = excluded.to_flow_id
            """, (from_node, to_node, step_id, to_flow_id))
        else:
            cursor.execute("""
                INSERT OR IGNORE INTO links (parent_node_id, child_node_id, step_id)
                VALUES (?, ?, ?)
            """, (from_node, to_node, step_id))

def delete_removed_links(cursor, step_id, submitted_links):
    cursor.execute("SELECT parent_node_id, child_node_id FROM links WHERE step_id = ? AND to_flow_id IS NULL", (step_id,))
    existing = {(row[0], row[1]) for row in cursor.fetchall()}
    submitted = {(link["from"], link["to"]) for link in submitted_links if not link.get("to_flow_id")}

    to_delete = existing - submitted

    for from_node, to_node in to_delete:
        cursor.execute("""
            DELETE FROM links 
            WHERE parent_node_id = ? AND child_node_id = ? AND step_id = ? AND to_flow_id IS NULL
        """, (from_node, to_node, step_id))

def fetch_links(cursor, step_id):
    cursor.execute("""
        SELECT parent_node_id AS `from`, 
               child_node_id AS `to`, 
               to_flow_id
        FROM links
        WHERE step_id = ?
    """, (step_id,))

    return [
        {"from": link[0], "to": link[1], "isCrossflow": False}
        for link in cursor.fetchall()
    ]

#--------------------------------------------------------------------------------------------------------------
#    Cross Flows
#--------------------------------------------------------------------------------------------------------------

def handle_crossflow_update(cursor, node_id, crossflow):
    if crossflow is None:
        return

    if crossflow.get("remove"):
        print(f"ðŸ§¹ Removing crossflow for node {node_id}")
        cursor.execute("""
            DELETE FROM links 
            WHERE parent_node_id = ? AND to_flow_id IS NOT NULL
        """, (node_id,))
    elif crossflow.get("target_flow_id") and crossflow.get("target_node_id"):
        print(f"ðŸ§© Updating crossflow for node {node_id}: {crossflow}")
        cursor.execute("""
            UPDATE links 
            SET to_flow_id = ?, child_node_id = ? 
            WHERE parent_node_id = ? AND to_flow_id IS NOT NULL
        """, (
            crossflow["target_flow_id"],
            crossflow["target_node_id"],
            node_id
        ))

def fetch_crossflows(cursor, parent_id=None):
    query = """
        SELECT 
            l.id AS link_id,
            l.parent_node_id,
            n1.name AS parent_node_name,
            l.child_node_id,
            n2.name AS child_node_name,
            l.to_flow_id,
            t.name AS target_flow_name
        FROM links l
        JOIN nodes n1 ON l.parent_node_id = n1.id
        JOIN nodes n2 ON l.child_node_id = n2.id
        JOIN steps t ON l.to_flow_id = t.id
    """
    if parent_id:
        query += " WHERE l.parent_node_id = ?"
        cursor.execute(query, (parent_id,))
    else:
        cursor.execute(query)
    return [dict(row) for row in cursor.fetchall()]

def save_crossflow(cursor, data):
    if data.get('link_id'):
        cursor.execute("""
            UPDATE links
            SET parent_node_id = ?, child_node_id = ?, step_id = ?, to_flow_id = ?
            WHERE id = ?;
        """, (
            data['source_node_id'],
            data['target_node_id'],
            data['step_id'],
            data['target_flow_id'],
            data['link_id']
        ))
    else:
        cursor.execute("""
            INSERT OR IGNORE INTO links (parent_node_id, child_node_id, step_id, to_flow_id)
            VALUES (?, ?, ?, ?);
        """, (
            data['source_node_id'],
            data['target_node_id'],
            data['step_id'],
            data['target_flow_id']
        ))

def delete_crossflow_by_nodes(cursor, parent_node_id, child_node_id):
    cursor.execute("""
        DELETE FROM links
        WHERE parent_node_id = ? AND child_node_id = ? AND to_flow_id IS NOT NULL
    """, (parent_node_id, child_node_id))

#--------------------------------------------------------------------------------------------------------------
#    Overview
#--------------------------------------------------------------------------------------------------------------

def update_workflow_state(cursor, data):
    flow_id = data.get('flow_id')
    new_state = data.get('new_state')

    if not flow_id or not new_state:
        raise ValueError("Missing required fields")

    cursor.execute("UPDATE steps SET current_state = ? WHERE id = ?", (new_state, flow_id))

    cursor.execute("SELECT child_node_id FROM links WHERE parent_node_id = ?", (flow_id,))
    connected_flows = cursor.fetchall()

    for flow in connected_flows:
        cursor.execute("UPDATE steps SET current_state = 'Grading' WHERE id = ?", (flow['child_node_id'],))

def get_workflow_states(cursor, individual_assignment_id):
    cursor.execute("""
        SELECT DISTINCT t.id, t.name
        FROM steps t
        JOIN individual_assignment_statuses ias ON t.id = ias.step_id
        WHERE ias.individual_assignment_id = ?
        ORDER BY t.id
    """, (individual_assignment_id,))
    steps = cursor.fetchall()

    workflow_states = {}

    for task in steps:
        cursor.execute("""
            SELECT current_status
            FROM individual_assignment_statuses
            WHERE individual_assignment_id = ? AND step_id = ?
        """, (individual_assignment_id, task['id']))
        current_status = cursor.fetchone()

        cursor.execute("""
            SELECT name, color, position, id as step_id
            FROM nodes
            WHERE step_id = ?
            ORDER BY CAST(substr(position, instr(position, ' ') + 1) AS FLOAT)
        """, (task['id'],))
        nodes = cursor.fetchall()

        workflow_states[task['name']] = [{
            'name': node['name'],
            'color': node['color'],
            'position': node['position'],
            'step_id': node['step_id'],
            'current_status': node['name'] == current_status['current_status']
        } for node in nodes]

    return workflow_states

def get_entire_workflow_data(cursor, individual_assignment_id=None, parent_step_id=None):
    if not parent_step_id:
        if not individual_assignment_id:
            raise ValueError("Missing parent_id or individual_assignment_id")

        row = cursor.execute("""
            SELECT DISTINCT a.parent_step_id
            FROM individual_assignments ia
            JOIN assignments a ON ia.assignment_id = a.id
            WHERE ia.id = ?
        """, (individual_assignment_id,)).fetchone()

        if not row:
            raise LookupError("Could not resolve parent_step_id from assignment")

        parent_step_id = row["parent_step_id"]

    results = cursor.execute("""
        SELECT DISTINCT
            t.id, t.name, t.order_num,
            n.id as node_id, n.name as node_name, n.color, n.position,
            COALESCE(ias.current_status, 
                     CASE WHEN t.id = 5 THEN 'Standby'
                          WHEN t.id = 6 THEN 'Waiting for Student to Upload'
                          WHEN t.id = 7 THEN '0 - Not completed'
                     END) as current_status
        FROM steps t
        JOIN nodes n ON t.id = n.step_id
        LEFT JOIN (
            SELECT step_id, current_status 
            FROM individual_assignment_statuses 
            WHERE individual_assignment_id = ?
            GROUP BY step_id
        ) ias ON t.id = ias.step_id
        WHERE t.parent_id IS NOT NULL
        AND t.parent_step_id = ?
        ORDER BY t.order_num, n.id
    """, (individual_assignment_id or 0, parent_step_id)).fetchall()

    return [dict(row) for row in results]

#--------------------------------------------------------------------------------------------------------------
#    SUMMARIES
#--------------------------------------------------------------------------------------------------------------

def get_flow_status_summary_data(cursor, flow_id=None, assignment_id=None, step_id=None):
    if not step_id:
        raise ValueError("step_id is required")

    if not assignment_id and not flow_id:
        raise ValueError("Either assignment_id or flow_id is required")

    query = """
        SELECT ias.current_status, s.name as step_name
        FROM individual_assignment_statuses ias
        JOIN individual_assignments ia ON ia.id = ias.individual_assignment_id
        JOIN assignments a ON ia.assignment_id = a.id
        JOIN steps s ON ias.step_id = s.id
        WHERE ias.step_id = ?
    """
    params = [step_id]

    if assignment_id:
        query += " AND ia.assignment_id = ? AND a.flow_id = (SELECT flow_id FROM assignments WHERE id = ?)"
        params += [assignment_id, assignment_id]
    elif flow_id:
        query += " AND a.flow_id = ?"
        params.append(flow_id)

    results = cursor.execute(query, tuple(params)).fetchall()

    # Group grades together
    output = {"grades": [], "statuses": []}
    for row in results:
        status = row["current_status"]
        step_name = row["step_name"]

        if step_name.lower().startswith("grade"):   # any step with 'Grade' in name
            output["grades"].append(status)
        else:
            output["statuses"].append(status)

    return output




