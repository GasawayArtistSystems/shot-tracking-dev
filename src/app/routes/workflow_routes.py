from flask import Flask, Blueprint, jsonify, request, render_template, make_response, current_app, session
from flask_cors import CORS
from app.database.db import get_db
from functools import wraps
import traceback
import sqlite3
import os
from werkzeug.utils import secure_filename
from app.utils.auth_utils import login_required
from app.utils.utils import role_required
from app.utils.workflow_utils import (
    fetch_nodes,fetch_links,fetch_overview_nodes_and_links,
    insert_node,update_node_details, save_nodes,save_links, handle_crossflow_update,
    cleanup_orphan_links,delete_removed_links,
    create_parent_flow_entry, delete_parent_flow,
    get_flow_by_id, update_flow, delete_individual_flow,
    fetch_crossflows, save_crossflow, delete_crossflow_by_nodes,
    update_workflow_state, get_workflow_states, get_entire_workflow_data, get_flow_status_summary_data

)

# Blueprint Setup
workflow_routes = Blueprint('workflow_routes', __name__)
CORS(workflow_routes, resources={r"/*": {"origins": "*"}})


def with_db_cursor(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        try:
            result = handler(cursor, *args, **kwargs)
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            print(f"âŒ DB Error: {e}")
            return jsonify({"error": str(e)}), 500
        finally:
            conn.close()
    return wrapped

def verify_admin_password(password):
    """Verify if the provided password matches the admin password."""
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "secret")  # or hardcoded fallback
    return password == ADMIN_PASSWORD

@workflow_routes.route('/editor')
@login_required
@role_required(['classes', 'films'], ['Admin', 'UPM'])
def workflow_editor():
    return render_template('workflow.html')

@workflow_routes.route('/api/verify-admin-password', methods=['POST'])
def verify_admin_password():
    data = request.json
    submitted_password = data.get("password")

    # [OK] Hardcoded admin password â€” replace with env var or hash later
    ADMIN_PASSWORD = "00New00"  # ðŸ”’ Replace this with your actual password

    if submitted_password == ADMIN_PASSWORD:
        return jsonify({"success": True})
    else:
        return jsonify({"success": False}), 403

@workflow_routes.before_request
def before_request():
    """Handle preflight requests and set CORS headers."""
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
    else:
        response = make_response()
    
    # Set CORS headers
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'DELETE, PUT, POST, GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'

#--------------------------------------------------------------------------------------------------------------
#    Flows
#--------------------------------------------------------------------------------------------------------------
@workflow_routes.route('/api/parent_flows', methods=['GET'])
def get_parent_flows():
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, name, min_permission_level, is_locked FROM steps WHERE parent_id IS NULL")
        parent_flows = cursor.fetchall()

        if not parent_flows:
            print("âŒ No parent flows found!")  # Debugging
            return jsonify([])  # Return an empty list if nothing is found

        # [OK] Return the fetched flows properly
        return jsonify([
            {"id": row["id"], "name": row["name"], "min_permission_level": row["min_permission_level"], "is_locked": row["is_locked"]}
            for row in parent_flows
        ])
    
    except Exception as e:
        print(f"âŒ Error fetching parent flows: {e}")
        return jsonify({"error": "Failed to fetch parent flows"}), 500
    
    finally:
        conn.close()

@workflow_routes.route('/api/child_flows', methods=['GET'])
def get_child_flows():
    parent_id = request.args.get('parent_id', type=int)

    if not parent_id:
        return jsonify({"error": "parent_id is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, name, is_locked, min_permission_level, order_num
            FROM steps
            WHERE parent_id = ?
            ORDER BY order_num ASC
        """, (parent_id,))
        flows = cursor.fetchall()

        if not flows:
            print(f"No flows found for parent_id={parent_id}. Is this correct?")
        else:
            print(f"Found {len(flows)} target flows: {flows}")

        return jsonify([
            {
                "id": row[0],
                "name": row[1],
                "is_locked": row[2],
                "min_permission_level": row[3],
                "order_num": row[4]  # ✅ include order_num
            }
            for row in flows
        ])


    except Exception as e:
        print(f"âŒ Error fetching target flows: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@workflow_routes.route('/api/child_nodes', methods=['GET'])
def get_child_nodes():
    step_id = request.args.get('step_id', type=int)

    if not step_id:
        print("âŒ ERROR: step_id is missing in request")
        return jsonify({"error": "step_id is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        print(f"ðŸ“¢ Fetching child nodes for step_id: {step_id}")

        cursor.execute("SELECT id, name FROM nodes WHERE step_id = ?", (step_id,))
        nodes = cursor.fetchall()

        if not nodes:
            print(f"âš ï¸ No nodes found for step_id {step_id}")
            return jsonify([])  # [OK] Return empty array instead of nothing

        node_list = [{"id": row[0], "name": row[1]} for row in nodes]
        print(f"[OK] Found nodes: {node_list}")  # [OK] Ensure output is JSON-friendly

        return jsonify(node_list)  # [OK] Always return valid JSON

    except Exception as e:
        print(f"âŒ Error fetching nodes: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@workflow_routes.route('/api/update_child_order', methods=['POST'])
def update_child_order():
    data = request.json
    order_data = data.get("order")

    if not order_data:
        return jsonify({"error": "Missing order data"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        for flow in order_data:
            cursor.execute("UPDATE steps SET order_num = ? WHERE id = ?", (flow["order_num"], flow["id"]))

        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        print(f"âŒ ERROR updating child order: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@workflow_routes.route('/api/sibling_flows', methods=['GET'])
def get_sibling_flows():
    current_step_id = request.args.get('step_id', type=int)
    if not current_step_id:
        print("Error: parent_id is missing or invalid")
        return jsonify({"error": "parent_id is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, parent_id FROM steps")
    steps = cursor.fetchall()
    for task in steps:
        print(dict(task))

    try:
        cursor.execute("SELECT parent_id FROM steps WHERE id = ?", (current_step_id,))
        parent = cursor.fetchone()

        if not parent:
            print(f"âŒ ERROR: Step ID {current_step_id} not found.")
            return jsonify({"error": "Step ID not found"}), 404

        parent_id = parent[0]

        if parent_id is None:
            print(f"âš ï¸ Step {current_step_id} is a root-level step. Finding other root-level steps.")
            cursor.execute("""
                SELECT id, name 
                FROM steps 
                WHERE parent_id IS NULL AND id != ?
            """, (current_step_id,))
        else:
            print(f"Fetching sibling steps for parent {parent_id}")
            cursor.execute("""
                SELECT id, name 
                FROM steps 
                WHERE parent_id = ? AND id != ?
            """, (parent_id, current_step_id))

        sibling_flows = [dict(id=row[0], name=row[1]) for row in cursor.fetchall()]

        return jsonify(sibling_flows)

    except Exception as e:
        print(f"âŒ ERROR fetching sibling flows: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

#--------------------------------------------------------------------------------------------------------------
#    Nodes
#--------------------------------------------------------------------------------------------------------------

@workflow_routes.route('/api/update_status', methods=['POST'])
def update_status():
    data = request.json
    conn = get_db()
    try:
        cursor = conn.cursor()

        # Log who is updating and what
        print(f"ðŸ”„ update_status: {data}")

        # Verify user permission level from session (if applicable)
        permission_level = session.get("permission_level", 1)

        # Check if the status entry already exists
        cursor.execute("""
            SELECT id FROM individual_assignment_statuses 
            WHERE individual_assignment_id = ? AND step_id = ?
        """, (data['individual_assignment_id'], data['step_id']))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE individual_assignment_statuses 
                SET current_status = ? 
                WHERE individual_assignment_id = ? AND step_id = ?
            """, (data['status'], data['individual_assignment_id'], data['step_id']))
        else:
            cursor.execute("""
                INSERT INTO individual_assignment_statuses (individual_assignment_id, step_id, current_status)
                VALUES (?, ?, ?)
            """, (data['individual_assignment_id'], data['step_id'], data['status']))

        # Handle crossflow if it exists
        if data.get("crossflow"):
            cf = data["crossflow"]
            cursor.execute("""
                INSERT OR IGNORE INTO links (parent_node_id, child_node_id, step_id, to_flow_id)
                VALUES (?, ?, ?, ?)
            """, (cf["from_node_id"], cf["to_node_id"], cf["step_id"], cf["to_flow_id"]))

        conn.commit()

        return jsonify({"success": True})

    except Exception as e:
        print(f"âŒ Error in update_status: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()

@workflow_routes.route('/api/node', methods=['POST'])
def add_node():
    data = request.json

    if not data.get('step_id'):
        return jsonify({"error": "Missing step_id for the node."}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        new_node_id = insert_node(cursor, data)

        conn.commit()
        return jsonify({
            "message": "Node added successfully",
            "node_id": new_node_id
        })

    except Exception as e:
        print(f"Error adding node: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()


def update_node_details(cursor, node_id, data):
    # Extract the required fields
    name = data.get("name")
    color = data.get("color")
    completion_percentage = data.get("completion_percentage")
    step_id = data.get("step_id")
    position = data.get("position")

    # Ensure all required fields are present
    if not name or color is None or completion_percentage is None or step_id is None or position is None:
        raise ValueError("Missing required fields for node update")

    # [OK] Update the node details in the database
    cursor.execute("""
        UPDATE nodes
        SET name = ?, color = ?, completion_percentage = ?, step_id = ?, position = ?
        WHERE id = ?
    """, (name, color, completion_percentage, step_id, position, node_id))



@workflow_routes.route('/api/node/<int:node_id>', methods=['PUT'])
def update_node(node_id):
    try:
        data = request.json
        conn = get_db()
        cursor = conn.cursor()

        # Extract required fields
        name = data.get("name")
        color = data.get("color")
        completion_percentage = data.get("completion_percentage")
        step_id = data.get("step_id")

        # Check for required fields (excluding position)
        if not name or color is None or completion_percentage is None or step_id is None:
            print("âŒ Missing required fields for node update")
            return jsonify({"error": "Missing required fields for node update"}), 400

        # Update the node details in the database (without position)
        cursor.execute(
            """UPDATE nodes SET name = ?, color = ?, completion_percentage = ?, step_id = ? WHERE id = ?""",
            (name, color, completion_percentage, step_id, node_id)
        )

        conn.commit()
        print("[OK] Node updated successfully in database")
        return jsonify({"success": True})

    except Exception as e:
        print(f"âŒ Error updating node in database: {str(e)}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()




@workflow_routes.route('/api/node/<int:node_id>', methods=['DELETE'])
def delete_node(node_id):
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            DELETE FROM links 
            WHERE (parent_node_id = ? OR child_node_id = ?)
              AND to_flow_id IS NULL;
        """, (node_id, node_id))

        cursor.execute("DELETE FROM nodes WHERE id = ?;", (node_id,))
        conn.commit()

        return jsonify({"message": "Node and direct links deleted successfully"})

    except Exception as e:
        print(f"âŒ Error deleting node and links: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

@workflow_routes.route('/api/delete_link', methods=['POST'])
def delete_link():
    """Delete a link between two nodes."""
    data = request.json
    from_node = data.get("from")
    to_node = data.get("to")

    if not from_node or not to_node:
        return jsonify({"success": False, "error": "Missing 'from' or 'to' node ID"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            DELETE FROM links 
            WHERE parent_node_id = ? AND child_node_id = ?
        """, (from_node, to_node))

        if cursor.rowcount == 0:
            return jsonify({"success": False, "error": "Link not found."}), 404

        conn.commit()
        return jsonify({"success": True})

    except Exception as e:
        conn.rollback()
        print(f"âŒ Error deleting link: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        conn.close()

@workflow_routes.route('/api/links', methods=['GET'])
def get_links():
    try:
        step_id = request.args.get("step_id", type=int)
        if not step_id:
            return jsonify({"error": "Missing step_id"}), 400

        conn = get_db()
        cursor = conn.cursor()

        links = fetch_links(cursor, step_id)
        print(f"ðŸ”— /api/links: Found {len(links)} links for step_id={step_id}")

        return jsonify(links)

    except Exception as e:
        print(f"âŒ Error in /api/links: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()
#--------------------------------------------------------------------------------------------------------------
#    Getting for individual assignments
#--------------------------------------------------------------------------------------------------------------

@workflow_routes.route('/api/get_flow_name', methods=['GET'])
def get_flow_name():
    try:
        step_id = request.args.get("step_id", type=int)
        if not step_id:
            return jsonify({"error": "Missing step_id"}), 400

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM steps WHERE id = ?", (step_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "Step not found"}), 404

        return jsonify({"name": row["name"]})

    except Exception as e:
        print(f"âŒ Error getting flow name: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()

@workflow_routes.route('/api/flowchart', methods=['GET'])
def get_flowchart_data():
    conn = None
    try:
        step_id = request.args.get("step_id", type=int)
        child_id = request.args.get("child_id", type=int)

        if not child_id:
            print("âš ï¸ child_id is missing, using step_id as fallback.")
            child_id = step_id

        if not child_id:
            return jsonify({"error": "child_id or step_id is required"}), 400

        conn = get_db()
        cursor = conn.cursor()

        nodes = fetch_nodes(cursor, child_id)
        print(f"ðŸ“¢ Found {len(nodes)} nodes for step_id={child_id}")

        links = fetch_links(cursor, child_id)
        print(f"ðŸ“¢ Found {len(links)} links for step_id={child_id}")

        return jsonify({"nodes": nodes or [], "links": links or []})

    except Exception as e:
        print(f"âŒ ERROR: Fetching flowchart data failed: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if conn:
            conn.close()

@workflow_routes.route('/api/save_flowchart', methods=['POST'])
def save_flowchart():
    try:
        data = request.json
        step_id = data.get("step_id")
        nodes = data.get("nodes", [])
        links = data.get("links", [])

        if not step_id:
            return jsonify({"success": False, "error": "Step ID is missing."}), 400

        conn = get_db()
        cursor = conn.cursor()

        cleanup_orphan_links(cursor)
        save_nodes(cursor, step_id, nodes)
        save_links(cursor, step_id, links)
        delete_removed_links(cursor, step_id, links)

        conn.commit()
        return jsonify({"success": True})

    except KeyError as e:
        return jsonify({"success": False, "error": f"Missing key: {str(e)}"}), 400
    except Exception as e:
        print("âŒ Error saving flowchart:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@workflow_routes.route('/api/get_parent_id', methods=['GET'])
def get_parent_id():
    current_id = request.args.get('current_id')
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT parent_id FROM steps WHERE id = ?", (current_id,))
        parent_id = cursor.fetchone()
        if parent_id:
            return jsonify({'parent_id': parent_id[0]})
        else:
            return jsonify({'error': 'Parent not found'}), 404
    except Exception as e:
        print(f"Error fetching parent ID: {e}")
        return jsonify({'error': 'Internal server error'}), 500
    finally:
        conn.close()

#--------------------------------------------------------------------------------------------------------------
#    Parent and Individual flows
#--------------------------------------------------------------------------------------------------------------
@workflow_routes.route('/api/parent_flows', methods=['POST'])
def create_parent_flow():
    try:
        data = request.json
        if not data or not data.get('name'):
            return jsonify({"error": "Flow name is required"}), 400

        conn = get_db()
        cursor = conn.cursor()

        new_flow = create_parent_flow_entry(cursor, data)
        conn.commit()

        return jsonify(new_flow)

    except sqlite3.IntegrityError as e:
        conn.rollback()
        print(f"Database integrity error: {e}")
        return jsonify({"error": "Flow name must be unique"}), 400
    except Exception as e:
        conn.rollback()
        print(f"Error creating parent flow: {e}")
        return jsonify({"error": "Failed to create Overall Flow"}), 500
    finally:
        conn.close()

@workflow_routes.route('/api/parent_flows/<int:flow_id>', methods=['GET', 'PUT', 'DELETE'])
@with_db_cursor
def manage_parent_flow(cursor, flow_id):
    data = request.json if request.method == 'PUT' else None

    if request.method == 'GET':
        flow = get_flow_by_id(cursor, flow_id, parent=True)
        if not flow:
            return jsonify({"error": "Flow not found"}), 404
        return jsonify(flow), 200

    elif request.method == 'PUT':
        if not data or not data.get('name'):
            return jsonify({"error": "Flow name is required"}), 400
        updated_flow = update_flow(cursor, flow_id, data, parent=True)
        if not updated_flow:
            return jsonify({"error": "Flow not found"}), 404
        return jsonify(updated_flow), 200

    elif request.method == 'DELETE':
        result = delete_parent_flow(cursor, flow_id)
        if not result["success"]:
            return jsonify(result), 404
        return jsonify(result), 200

@workflow_routes.route('/api/individual_flows', methods=['POST'])
def create_individual_flow():
    """Create a new individual flow, optionally from a template."""
    print("ðŸ”„ Creating new individual flow")

    conn = get_db()
    cursor = conn.cursor()

    try:
        data = request.json
        print("ðŸ“Œ Incoming Data:", data)

        if not data or not data.get('name') or not data.get('parent_id'):
            return jsonify({"error": "Name and parent_id are required"}), 400

        permission_level = int(data.get('permission_level', 1))
        template_id = data.get('template_id')

        cursor.execute("SELECT workflow_id FROM steps WHERE id = ?", (data['parent_id'],))
        parent_flow = cursor.fetchone()

        if not parent_flow or parent_flow[0] is None:
            return jsonify({"error": "Parent flow not found or missing workflow_id"}), 400

        workflow_id = parent_flow[0]

        # [OK] Get the next order number for this parent
        cursor.execute("SELECT MAX(order_num) FROM steps WHERE parent_id = ?", (data['parent_id'],))
        max_order = cursor.fetchone()[0] or 0
        new_order_num = max_order + 1
        print(f"ðŸ”¢ Assigned order_num: {new_order_num}")

        cursor.execute("BEGIN")
        cursor.execute("""
            INSERT INTO steps (name, parent_id, min_permission_level, workflow_id, order_num)
            VALUES (?, ?, ?, ?, ?)
        """, (data['name'], data['parent_id'], permission_level, workflow_id, new_order_num))

        flow_id = cursor.lastrowid
        print(f"[OK] Created flow with ID: {flow_id}, Permission Level: {permission_level}, Workflow ID: {workflow_id}")

        if template_id:
            print(f"ðŸ”„ Copying nodes from template {template_id}")

            cursor.execute("SELECT name, position, completion_percentage, color FROM nodes WHERE step_id = ?", (template_id,))
            template_nodes = cursor.fetchall()

            if template_nodes:
                print(f"ðŸ“Œ Found {len(template_nodes)} nodes in template {template_id}. Copying...")
                for node in template_nodes:
                    cursor.execute("""
                        INSERT INTO nodes (name, step_id, position, completion_percentage, color)
                        VALUES (?, ?, ?, ?, ?)
                    """, (node[0], flow_id, node[1], node[2], node[3]))
                    print(f"[OK] Copied node: {node[0]}")
            else:
                print(f"âš ï¸ No nodes found for template {template_id}")

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Individual flow created successfully",
            "id": flow_id,
            "child_id": flow_id,
            "workflow_id": workflow_id
        })

    except Exception as e:
        conn.rollback()
        print(f"âŒ Error creating individual flow: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

@workflow_routes.route('/api/individual_flows/<int:flow_id>', methods=['GET', 'PUT', 'DELETE'])
@with_db_cursor
def manage_individual_flow(cursor, flow_id):
    if request.method == 'GET':
        flow = get_flow_by_id(cursor, flow_id, parent=False)
        if not flow:
            return jsonify({"error": "Flow not found"}), 404
        return jsonify(flow), 200

    elif request.method == 'PUT':
        data = request.json
        if not data or not data.get('name'):
            return jsonify({"error": "Flow name is required"}), 400
        updated = update_flow(cursor, flow_id, data, parent=False)
        if not updated:
            return jsonify({"error": "Flow not found"}), 404
        return jsonify(updated), 200

    elif request.method == 'DELETE':
        result = delete_individual_flow(cursor, flow_id)
        if not result["success"]:
            return jsonify(result), 404
        return jsonify(result), 200

#--------------------------------------------------------------------------------------------------------------
#    Cross Flows
#--------------------------------------------------------------------------------------------------------------
@workflow_routes.route('/api/crossflows', methods=['GET'])
@with_db_cursor
def get_crossflows(cursor):
    node_id = request.args.get('node_id', type=int)
    parent_id = request.args.get('parent_id', type=int)

    if node_id:
        # Get crossflows for a specific node
        cursor.execute("""
            SELECT l.parent_node_id, l.child_node_id, l.to_flow_id,
                   n1.name AS source_node_name,
                   n2.name AS target_node_name,
                   s.name AS target_flow_name
            FROM links l
            JOIN nodes n1 ON l.parent_node_id = n1.id
            JOIN nodes n2 ON l.child_node_id = n2.id
            JOIN steps s ON l.to_flow_id = s.id
            WHERE l.parent_node_id = ?
        """, (node_id,))
        crossflows = [dict(row) for row in cursor.fetchall()]
    elif parent_id:
        crossflows = fetch_crossflows(cursor, parent_id)
    else:
        crossflows = []

    return jsonify({"crossflows": crossflows})


@workflow_routes.route('/api/crossflow', methods=['POST'])
@with_db_cursor
def create_or_update_crossflow(cursor):
    data = request.json
    print("[Crossflow] Received:", data)

    required_fields = ['source_node_id', 'target_flow_id', 'target_node_id', 'step_id']
    if not all(field in data for field in required_fields):
        print("[ERROR] Missing required fields:", data)
        return jsonify({"error": "Missing required fields"}), 400

    # Convert to integers to match DB schema
    source_node_id = int(data['source_node_id'])
    new_flow_id = int(data['target_flow_id'])
    new_node_id = int(data['target_node_id'])
    step_id = int(data.get('step_id'))

    if not step_id or step_id == source_node_id:
        print("[ERROR] Invalid step_id:", step_id)
        return jsonify({"error": "Invalid step_id"}), 400

    # Old values (used for editing)
    old_child_id = data.get("old_child_id")
    old_flow_id = data.get("old_flow_id")

    if old_child_id and old_flow_id:
        # Try to update existing record
        cursor.execute("""
            UPDATE links 
            SET child_node_id = ?, to_flow_id = ?
            WHERE parent_node_id = ? 
              AND step_id = ? 
              AND child_node_id = ? 
              AND to_flow_id = ?
        """, (new_node_id, new_flow_id, source_node_id, step_id, int(old_child_id), int(old_flow_id)))

        if cursor.rowcount > 0:
            cursor.connection.commit()
            print("[OK] Crossflow updated:", (source_node_id, old_child_id, old_flow_id, "→", new_node_id, new_flow_id))
            return jsonify({"success": True, "message": "Crossflow updated successfully!"})

    # If no old values, or update didn’t match, insert new
    cursor.execute("""
        INSERT INTO links (parent_node_id, child_node_id, to_flow_id, step_id)
        VALUES (?, ?, ?, ?)
    """, (source_node_id, new_node_id, new_flow_id, step_id))

    cursor.connection.commit()
    print("[OK] Created new crossflow:", (source_node_id, new_node_id, new_flow_id))
    return jsonify({"success": True, "message": "Crossflow created successfully!"})



@workflow_routes.route('/api/delete_crossflow', methods=['POST'])
@with_db_cursor
def delete_crossflow(cursor):
    data = request.json
    parent_node_id = data.get("parent_node_id")
    child_node_id = data.get("child_node_id")
    to_flow_id = data.get("to_flow_id")  # New line to include flow ID

    # Validate the required fields
    if not parent_node_id or not child_node_id or not to_flow_id:
        return jsonify({"success": False, "error": "Missing required fields"}), 400

    # Delete the crossflow link
    cursor.execute("""
        DELETE FROM links 
        WHERE parent_node_id = ? 
        AND child_node_id = ?
        AND to_flow_id = ?
    """, (parent_node_id, child_node_id, to_flow_id))

    if cursor.rowcount == 0:
        return jsonify({"success": False, "error": "Crossflow not found."}), 404

    return jsonify({"success": True})


#--------------------------------------------------------------------------------------------------------------
#    Overview
#--------------------------------------------------------------------------------------------------------------

@workflow_routes.route('/api/overview', methods=['GET'])
def get_overview():
    try:
        parent_id = request.args.get("parent_id", type=int)
        if not parent_id:
            return jsonify({"error": "Missing parent_id"}), 400

        conn = get_db()
        cursor = conn.cursor()

        nodes, links = fetch_overview_nodes_and_links(cursor, parent_id)
        print(f"ðŸ“Š Overview: Fetched {len(nodes)} nodes, {len(links)} links for parent_id={parent_id}")

        return jsonify({"nodes": nodes, "links": links})

    except Exception as e:
        print(f"âŒ Error in /api/overview: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if 'conn' in locals():
            conn.close()

@workflow_routes.route('/api/nodes', methods=['GET'])
@with_db_cursor
def get_nodes_for_workflow(cursor):
    parent_step_id = request.args.get('parent_step_id', type=int)
    if not parent_step_id:
        return jsonify({"error": "Missing parent_step_id"}), 400
    nodes = fetch_nodes(cursor, parent_step_id)
    return jsonify(nodes)

@workflow_routes.route('/api/update_state', methods=['POST'])
@with_db_cursor
def update_state_route(cursor):
    data = request.json
    update_workflow_state(cursor, data)
    return jsonify({"success": True}), 200

@workflow_routes.route('/api/workflow_states')
@with_db_cursor
def get_workflow_states_route(cursor):
    individual_assignment_id = request.args.get('individual_assignment_id')
    if not individual_assignment_id:
        return jsonify({"error": "Missing individual_assignment_id"}), 400
    result = get_workflow_states(cursor, individual_assignment_id)
    return jsonify(result)

@workflow_routes.route('/api/entire_workflow', methods=['GET'])
@with_db_cursor
def get_entire_workflow(cursor):
    individual_assignment_id = request.args.get('individual_assignment_id', type=int)
    parent_step_id = request.args.get('parent_id', type=int)

    try:
        results = get_entire_workflow_data(cursor, individual_assignment_id, parent_step_id)
        return jsonify(results)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except LookupError as le:
        return jsonify({"error": str(le)}), 404

@workflow_routes.route('/<path:path>', methods=['GET', 'POST'])
def catch_all(path):
    print(f"Catch-all hit: {path}")
    return jsonify({"status": "Catch-all hit", "path": path}), 200

#--------------------------------------------------------------------------------------------------------------
#    SUMMARIES
#--------------------------------------------------------------------------------------------------------------
    
@workflow_routes.route('/api/assignment_status_summary', methods=['GET'])
@with_db_cursor
def get_assignment_status_summary(cursor):
    assignment_id = request.args.get('assignment_id', type=int)
    step_id = request.args.get('step_id', type=int)

    if not assignment_id or not step_id:
        return jsonify({"error": "Assignment ID and Task ID are required"}), 400

    try:
        results = get_flow_status_summary_data(cursor, assignment_id=assignment_id, step_id=step_id)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@workflow_routes.route('/api/flow_status_summary', methods=['GET'])
@with_db_cursor
def get_flow_status_summary(cursor):
    flow_id = request.args.get('flow_id', type=int)
    step_id = request.args.get('step_id', type=int)

    if not flow_id or not step_id:
        return jsonify({"error": "Flow ID and Task ID are required"}), 400

    try:
        results = get_flow_status_summary_data(cursor, flow_id=flow_id, step_id=step_id)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500



